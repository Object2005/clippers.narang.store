"""
GTAClipper FastAPI application.

This is the new main entry point with:
- Separated concerns (routes, services, repositories, workers)
- Async job queue with arq
- Real-time progress updates via SSE
- Thread pool for blocking operations
"""

from contextlib import asynccontextmanager
import logging
import time

from fastapi import FastAPI, Depends, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError
from fastapi.encoders import jsonable_encoder
from sqlalchemy.ext.asyncio import AsyncSession

from .config import Config, get_config, set_config_override
from .database import AsyncSessionLocal, close_db, configure_database, get_db, init_db
from .runtime_settings import load_runtime_settings_cache
from .workers.job_queue import JobQueue
from .api.routes import tasks
from .api.routes.admin import router as admin_router
from .observability import (
    TRACE_HEADER,
    clear_trace_id,
    configure_logging,
    generate_trace_id,
    get_trace_id,
    set_trace_id,
    set_user_id,
)
from .source_submission import is_task_create_request, log_task_create_validation_error

configure_logging()

logger = logging.getLogger(__name__)
def create_app(
    *,
    config: Config | None = None,
    session_maker=None,
    queue_adapter=JobQueue,
):
    if config is None:
        set_config_override(None)
        runtime_config = get_config()
    else:
        runtime_config = config
        set_config_override(runtime_config)
    if session_maker is not None:
        configure_database(
            session_maker=session_maker,
            engine=session_maker.kw.get("bind"),
        )

    @asynccontextmanager
    async def lifespan(app: FastAPI):
        """Application lifespan: startup and shutdown events."""
        logger.info("🚀 Starting GTAClipper API...")
        try:
            await init_db()
            logger.info("✅ Database initialized")
            async with AsyncSessionLocal() as db:
                await load_runtime_settings_cache(db)
            logger.info("✅ Runtime settings loaded")

            pool = await queue_adapter.get_pool()
            logger.info("✅ Job queue initialized")
            try:
                # A worker compares this with its own disk before it renders
                # clips that only this API's disk could serve.
                from .local_volume import API_VOLUME_KEY, volume_id

                await pool.set(API_VOLUME_KEY, volume_id(runtime_config.temp_dir))
            except Exception:
                logger.warning("Could not publish the API media volume id", exc_info=True)

            yield
        finally:
            logger.info("🛑 Shutting down GTAClipper API...")
            await close_db()
            await queue_adapter.close_pool()
            logger.info("✅ Cleanup complete")

    app = FastAPI(
        title="GTAClipper API",
        description="GTAClipper backend with async job processing",
        version="0.2.0",
        lifespan=lifespan,
    )
    app.state.queue_adapter = queue_adapter
    app.state.config = runtime_config

    app.add_middleware(
        CORSMiddleware,
        allow_origins=runtime_config.cors_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=[
            "Content-Type",
            "Authorization",
            "x-gtaclipper-user-id",
            "x-gtaclipper-ts",
            "x-gtaclipper-signature",
            "x-trace-id",
            "user_id",
            "Idempotency-Key",
        ],
        expose_headers=["x-trace-id"],
    )

    # app.add_middleware(GZipMiddleware, minimum_size=1000)

    # Security: In-memory sliding window rate limiter fallback
    _ip_request_counts: dict[str, list[float]] = {}
    MAX_REQUESTS_PER_MINUTE = 120

    @app.middleware("http")
    async def security_and_rate_limit_middleware(request: Request, call_next):
        # 1. Enforce payload size check to prevent memory exhaustion / drive abuse
        content_length = request.headers.get("content-length")
        if content_length:
            try:
                if int(content_length) > runtime_config.max_video_upload_bytes:
                    return JSONResponse(
                        status_code=413,
                        content={"error": "Payload too large. Maximum file upload size is 4GB."},
                    )
            except ValueError:
                pass

        # 2. Rate Limiting per Client IP (prevents API spam, brute-force, scraping)
        client_ip = request.client.host if request.client else "unknown"
        # Exempt healthchecks
        if request.url.path not in ("/health", "/api/health", "/ready"):
            now = time.time()
            req_times = _ip_request_counts.setdefault(client_ip, [])
            # prune requests older than 60s
            _ip_request_counts[client_ip] = [t for t in req_times if now - t < 60.0]
            if len(_ip_request_counts[client_ip]) >= MAX_REQUESTS_PER_MINUTE:
                return JSONResponse(
                    status_code=429,
                    content={"error": "Rate limit exceeded. Too many requests. Please wait a minute."},
                    headers={"Retry-After": "60", "X-Content-Type-Options": "nosniff"},
                )
            _ip_request_counts[client_ip].append(now)

        response = await call_next(request)

        # 3. HTTP Security Headers (prevent MIME-sniffing, Clickjacking, XSS)
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["X-XSS-Protection"] = "1; mode=block"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        return response

    @app.middleware("http")
    async def trace_and_request_logging_middleware(request: Request, call_next):
        trace_id = request.headers.get(TRACE_HEADER) or generate_trace_id()
        set_trace_id(trace_id)
        started_at = time.perf_counter()

        logger.info("Incoming request %s %s", request.method, request.url.path)

        try:
            response = await call_next(request)
        except Exception:
            set_user_id(getattr(request.state, "user_id", None))
            logger.exception("Unhandled exception while processing request")
            clear_trace_id()
            set_user_id(None)
            raise

        # The endpoint ran in its own context; bring the user it authenticated
        # back into this one so the completion log line carries it.
        set_user_id(getattr(request.state, "user_id", None))
        elapsed_ms = round((time.perf_counter() - started_at) * 1000, 2)
        response.headers[TRACE_HEADER] = trace_id
        logger.info(
            "Completed request %s %s with status %s in %sms",
            request.method,
            request.url.path,
            response.status_code,
            elapsed_ms,
        )
        clear_trace_id()
        set_user_id(None)
        return response

    @app.exception_handler(HTTPException)
    async def http_exception_handler(_: Request, exc: HTTPException):
        trace_id = get_trace_id()
        logger.warning(
            "HTTP exception: status=%s detail=%s", exc.status_code, exc.detail
        )
        return JSONResponse(
            status_code=exc.status_code,
            content=jsonable_encoder({"detail": exc.detail, "trace_id": trace_id}),
            headers={TRACE_HEADER: trace_id},
        )

    @app.exception_handler(RequestValidationError)
    async def validation_exception_handler(request: Request, exc: RequestValidationError):
        trace_id = get_trace_id()
        # Task creation logs a sanitized source line instead of exc.errors(),
        # which includes the submitted input (query tokens and all).
        if is_task_create_request(request.method, request.url.path):
            await log_task_create_validation_error(request, exc)
        else:
            logger.warning("Validation error: %s", exc.errors())
        return JSONResponse(
            status_code=422,
            content={"detail": exc.errors(), "trace_id": trace_id},
            headers={TRACE_HEADER: trace_id},
        )

    @app.exception_handler(Exception)
    async def unhandled_exception_handler(request: Request, exc: Exception):
        trace_id = get_trace_id()
        set_user_id(getattr(request.state, "user_id", None))
        logger.error("Unhandled server error: %s", exc, exc_info=True)
        return JSONResponse(
            status_code=500,
            content={
                "detail": "An internal server error occurred. Contact support with the trace ID.",
                "trace_id": trace_id,
            },
            headers={TRACE_HEADER: trace_id},
        )

    app.include_router(tasks.router)
    from .api.routes.clip_exports import router as clip_export_router
    from .api.routes.editor import router as editor_router
    app.include_router(clip_export_router)
    app.include_router(editor_router)
    app.include_router(admin_router)

    from .api.routes.media import router as media_router
    from .api.routes.feedback import router as feedback_router
    from .api.routes.billing import router as billing_router
    from .api.routes.api_keys import router as api_keys_router
    from .api.routes.account import router as account_router
    from .api.routes.social import router as social_router
    from .api.routes.email_preferences import router as email_preferences_router
    from .api.routes.feature_flags import router as feature_flags_router
    from .api.routes.mcp_oauth import consent_router as mcp_oauth_consent_router
    from .api.routes.mcp_oauth import internal_router as mcp_oauth_internal_router

    app.include_router(media_router)
    app.include_router(feedback_router)
    app.include_router(billing_router)
    app.include_router(api_keys_router)
    app.include_router(account_router)
    app.include_router(social_router)
    app.include_router(email_preferences_router)
    app.include_router(feature_flags_router)
    app.include_router(mcp_oauth_internal_router)
    app.include_router(mcp_oauth_consent_router)

    @app.get("/")
    def read_root():
        """Root endpoint."""
        return {
            "name": "GTAClipper API",
            "version": "0.2.0",
            "status": "running",
            "docs": "/docs",
            "architecture": "job queue",
        }

    @app.get("/health")
    async def health_check():
        """Basic health check."""
        return {"status": "healthy"}

    @app.get("/health/db")
    async def check_database_health(db: AsyncSession = Depends(get_db)):
        """Check database connectivity."""
        from sqlalchemy import text

        try:
            await db.execute(text("SELECT 1"))
            return {"status": "healthy", "database": "connected"}
        except Exception as e:
            logger.error("Database health check failed: %s", e)
            return JSONResponse(
                status_code=503,
                content={"status": "unhealthy", "database": "disconnected"},
            )

    @app.get("/health/redis")
    async def check_redis_health():
        """Check Redis connectivity."""
        try:
            pool = await app.state.queue_adapter.get_pool()
            await pool.ping()
            return {"status": "healthy", "redis": "connected"}
        except Exception as e:
            return {
                "status": "unhealthy",
                "redis": "disconnected",
                "error": str(e),
            }

    @app.get("/health/worker")
    async def check_worker_health():
        """Check ARQ's expiring heartbeat, not just Redis connectivity."""
        from arq.constants import health_check_key_suffix
        from .workers.job_queue import DEFAULT_QUEUE_NAME

        try:
            pool = await app.state.queue_adapter.get_pool()
            heartbeat = await pool.get(DEFAULT_QUEUE_NAME + health_check_key_suffix)
            if heartbeat:
                return {"status": "healthy", "worker": "connected"}
        except Exception:
            logger.exception("Worker heartbeat check failed")
        return JSONResponse(
            status_code=503,
            content={"status": "unhealthy", "worker": "unavailable"},
        )

    @app.get("/health/storage")
    async def check_storage_health():
        """Read cached worker probes; public requests never perform writes."""
        from .media_replication_ledger import read_storage_health

        config = get_config()
        if not getattr(config, "media_fallback_enabled", False):
            return {"status": "unmonitored", "replication": "disabled"}
        try:
            # The probe runs on the cron host; the report is in PostgreSQL so any API host can answer.
            async with AsyncSessionLocal() as session:
                report = await read_storage_health(session)
            if time.time() - report["checked_at"] > 180:
                report = {"status": "unhealthy", "reason": "stale_probe"}
        except Exception:
            # A missing or malformed report and an unreachable database look the same to a monitor.
            report = {"status": "unhealthy", "reason": "probe_unavailable"}
        return JSONResponse(status_code=200 if report.get("status") == "healthy" else 503, content=report,
                            headers={"Cache-Control": "no-store"})

    return app


app = create_app()
