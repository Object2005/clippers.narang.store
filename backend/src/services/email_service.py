from __future__ import annotations

import asyncio
import logging
import os
import smtplib
import ssl
import uuid
from dataclasses import dataclass, replace
from email import policy
from email.message import EmailMessage
from typing import Optional

import boto3

from ..config import Config
from ..database import get_session_maker
from ..models import EmailDelivery
from .email_layout import is_full_document, render_email_html

logger = logging.getLogger(__name__)

TRANSACTIONAL = "transactional"
# Product announcements must honour the opt-out: send them only through
# ProductUpdateEmailService, which checks it and adds the unsubscribe headers.
PRODUCT_UPDATE = "product_update"


@dataclass(frozen=True)
class InlineImage:
    """An image shown in the body via ``<img src="cid:{content_id}">``.

    Use an address-like id (``clip0@gtaclipper``), as RFC 2392 expects.
    """

    content_id: str
    data: bytes
    content_type: str = "image/jpeg"


@dataclass(frozen=True)
class EmailContent:
    subject: str
    html: str
    text: str
    headers: tuple[tuple[str, str], ...] = ()
    category: str = TRANSACTIONAL
    inline_images: tuple[InlineImage, ...] = ()
    reply_to: tuple[str, ...] = ()


class SesEmailService:
    def __init__(self, config: Optional[Config] = None):
        self.config = config or Config()
        self.region = self.config.aws_region
        self.access_key_id = self.config.aws_access_key_id
        self.secret_access_key = self.config.aws_secret_access_key
        self.from_email = self.config.ses_from_email
        self._client = None

    @property
    def is_ses_configured(self) -> bool:
        return bool(
            self.region
            and self.access_key_id
            and self.secret_access_key
            and self.from_email
        )

    @property
    def is_smtp_configured(self) -> bool:
        return bool(
            os.getenv("SMTP_HOST")
            and (os.getenv("SMTP_USER") or os.getenv("SMTP_USERNAME"))
            and (os.getenv("SMTP_PASSWORD") or os.getenv("SMTP_PASS"))
        )

    @property
    def is_configured(self) -> bool:
        return self.is_ses_configured or self.is_smtp_configured

    def _raw_message(self, recipient: str, content: EmailContent) -> bytes:
        """MIME for emails with inline images.

        multipart/alternative(text, multipart/related(html, images)) is the
        shape Outlook needs to show images in the body instead of listing them
        as attachments; SES's Simple attachments don't guarantee it.
        """
        message = EmailMessage()
        message["From"] = self.from_email
        message["To"] = recipient
        message["Subject"] = content.subject
        for name, value in content.headers:
            message[name] = value
        message.set_content(content.text)
        message.add_alternative(content.html, subtype="html")
        html_part = message.get_payload()[1]
        for image in content.inline_images:
            maintype, subtype = image.content_type.split("/", 1)
            html_part.add_related(
                image.data,
                maintype=maintype,
                subtype=subtype,
                cid=f"<{image.content_id}>",
                disposition="inline",
                filename=f"{image.content_id.split('@')[0]}.{subtype}",
            )
        return message.as_bytes(policy=policy.SMTP)

    def _send(self, recipient: str, content: EmailContent) -> dict:
        headers = [{"Name": name, "Value": value} for name, value in content.headers]
        # boto3 clients are thread-safe; reuse one across a campaign's sends.
        if self._client is None:
            self._client = boto3.client(
                "sesv2",
                region_name=self.region,
                aws_access_key_id=self.access_key_id,
                aws_secret_access_key=self.secret_access_key,
            )
        if content.inline_images:
            return self._client.send_email(
                FromEmailAddress=self.from_email,
                Destination={"ToAddresses": [recipient]},
                Content={"Raw": {"Data": self._raw_message(recipient, content)}},
            )
        return self._client.send_email(
            FromEmailAddress=self.from_email,
            Destination={"ToAddresses": [recipient]},
            **({"ReplyToAddresses": list(content.reply_to)} if content.reply_to else {}),
            Content={
                "Simple": {
                    **({"Headers": headers} if headers else {}),
                    "Subject": {"Data": content.subject, "Charset": "UTF-8"},
                    "Body": {
                        "Html": {"Data": content.html, "Charset": "UTF-8"},
                        "Text": {"Data": content.text, "Charset": "UTF-8"},
                    },
                }
            },
        )

    def _send_smtp(self, recipient: str, content: EmailContent) -> dict:
        host = os.getenv("SMTP_HOST", "smtp.gmail.com")
        port = int(os.getenv("SMTP_PORT", "587"))
        user = os.getenv("SMTP_USER") or os.getenv("SMTP_USERNAME", "")
        password = os.getenv("SMTP_PASSWORD") or os.getenv("SMTP_PASS", "")
        from_email = os.getenv("SMTP_FROM_EMAIL") or self.from_email or user

        message = EmailMessage()
        message["From"] = from_email
        message["To"] = recipient
        message["Subject"] = content.subject
        for name, value in content.headers:
            message[name] = value
        message.set_content(content.text)
        message.add_alternative(content.html, subtype="html")

        if port == 465:
            context = ssl.create_default_context()
            with smtplib.SMTP_SSL(host, port, context=context) as server:
                if user and password:
                    server.login(user, password)
                server.send_message(message)
        else:
            with smtplib.SMTP(host, port, timeout=10) as server:
                server.ehlo()
                try:
                    server.starttls(context=ssl.create_default_context())
                    server.ehlo()
                except Exception:
                    pass
                if user and password:
                    server.login(user, password)
                server.send_message(message)

        return {"MessageId": f"smtp-{uuid.uuid4()}", "provider": "smtp"}

    async def send_email(self, recipient: str, content: EmailContent) -> dict:
        if content.category == PRODUCT_UPDATE and not any(
            name.lower() == "list-unsubscribe-post" for name, _ in content.headers
        ):
            raise ValueError("Send product updates through ProductUpdateEmailService")
        if not is_full_document(content.html):
            content = replace(
                content, html=render_email_html(
                    content.html, app_url=getattr(self.config, "app_base_url", "")
                )
            )

        if self.is_smtp_configured:
            try:
                response = await asyncio.to_thread(self._send_smtp, recipient, content)
            except Exception as exc:
                logger.error("SMTP delivery failed for %s: %s", recipient, exc)
                response = {"MessageId": f"smtp-failed-{uuid.uuid4()}", "error": str(exc), "provider": "smtp_failed"}
        elif self.is_ses_configured:
            response = await asyncio.to_thread(self._send, recipient, content)
        else:
            # Local / fallback sink: log the email content prominently so reset links are immediately accessible
            msg_id = f"local-sink-{uuid.uuid4()}"
            logger.warning("==================================================================")
            logger.warning("📧 [PASSWORD RESET / EMAIL SINK] Email to: %s", recipient)
            logger.warning("📧 Subject: %s", content.subject)
            logger.warning("📧 Text Body:\n%s", content.text)
            logger.warning("==================================================================")
            response = {"MessageId": msg_id, "provider": "local_sink", "status": "logged"}

        message_id = response.get("MessageId", f"msg-{uuid.uuid4()}")
        try:
            async with get_session_maker()() as db:
                db.add(EmailDelivery(
                    message_id=message_id,
                    recipient=recipient,
                    subject=content.subject,
                    region=self.region or "local",
                ))
                await db.commit()
        except Exception:
            logger.exception(
                "Email audit persistence failed: message_id=%s recipient=%s subject=%r",
                message_id, recipient, content.subject,
            )
        return dict(response)


def first_name_for(
    *,
    first_name: Optional[str] = None,
    full_name: Optional[str] = None,
    default: str = "there",
) -> str:
    if first_name and first_name.strip():
        return first_name.strip()
    if full_name and full_name.strip():
        return full_name.strip().split()[0]
    return default
