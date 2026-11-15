import crypto from "node:crypto";
import { POST } from "./route";
import { getPrismaClient } from "@/server/prisma";
import { fetchBackend } from "@/server/backend-api";

vi.mock("@/server/prisma", () => ({ getPrismaClient: vi.fn() }));
vi.mock("@/server/backend-api", () => ({ fetchBackend: vi.fn() }));
vi.mock("@/server/affiliates", () => ({ restoreAffiliateProIfApproved: vi.fn().mockResolvedValue(false) }));

const sign = (body: string) => crypto.createHmac("sha256", "hook_secret").update(body).digest("hex");

describe("/api/billing/razorpay-webhook", () => {
  const env = process.env;
  const realFetch = global.fetch;
  const user = { findUnique: vi.fn(), update: vi.fn(), updateMany: vi.fn() };
  const razorpayWebhookEvent = { create: vi.fn(), delete: vi.fn() };

  beforeEach(() => {
    vi.clearAllMocks();
    process.env = {
      ...env,
      RAZORPAY_KEY_ID: "rzp_test_key",
      RAZORPAY_KEY_SECRET: "key_secret",
      RAZORPAY_WEBHOOK_SECRET: "hook_secret",
      RAZORPAY_PRO_PLAN_ID: "plan_pro_month",
    };
    vi.mocked(getPrismaClient).mockReturnValue({ user, razorpayWebhookEvent } as never);
    vi.mocked(fetchBackend).mockResolvedValue(new Response("{}", { status: 200 }));
    razorpayWebhookEvent.create.mockResolvedValue({});
    razorpayWebhookEvent.delete.mockResolvedValue({});
    user.findUnique.mockResolvedValue({ id: "u1", plan: "free", subscription_status: "inactive", subscription_provider: null });
    // Razorpay's API answers with the subscription's current state.
    global.fetch = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({ id: "sub_1", plan_id: "plan_pro_month", status: "active", current_start: 1, current_end: 2 }),
        { status: 200 },
      ),
    ) as typeof fetch;
  });

  afterAll(() => {
    process.env = env;
    global.fetch = realFetch;
  });

  function request(body: unknown, signature?: string, eventId = "evt_1") {
    const raw = JSON.stringify(body);
    return new Request("http://localhost/api/billing/razorpay-webhook", {
      method: "POST",
      headers: { "x-razorpay-signature": signature ?? sign(raw), "x-razorpay-event-id": eventId },
      body: raw,
    });
  }

  const charged = { event: "subscription.charged", payload: { subscription: { entity: { id: "sub_1", status: "active" } } } };

  it("rejects a bad signature", async () => {
    const response = await POST(request(charged, "deadbeef"));
    expect(response.status).toBe(401);
    expect(user.update).not.toHaveBeenCalled();
  });

  it("re-reads the subscription from Razorpay and grants the plan", async () => {
    const response = await POST(request(charged));
    expect(response.status).toBe(200);
    expect(global.fetch).toHaveBeenCalledWith(
      "https://api.razorpay.com/v1/subscriptions/sub_1",
      expect.objectContaining({ method: "GET" }),
    );
    expect(user.update).toHaveBeenCalledWith({
      where: { id: "u1" },
      data: expect.objectContaining({ plan: "pro", subscription_status: "active", subscription_provider: "razorpay" }),
    });
  });

  it("skips an event it already processed", async () => {
    razorpayWebhookEvent.create.mockRejectedValue({ code: "P2002" });
    const response = await POST(request(charged));
    expect(await response.json()).toEqual({ ok: true, duplicate: true });
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("forgets the event when processing fails so Razorpay retries it", async () => {
    vi.mocked(global.fetch).mockResolvedValue(new Response("{}", { status: 500 }));
    const response = await POST(request(charged));
    expect(response.status).toBe(500);
    expect(razorpayWebhookEvent.delete).toHaveBeenCalledWith({ where: { id: "evt_1" } });
  });

  it("ignores non-subscription events", async () => {
    const response = await POST(request({ event: "payment.captured", payload: {} }));
    expect(await response.json()).toEqual({ ok: true, ignored: true });
    expect(razorpayWebhookEvent.create).not.toHaveBeenCalled();
  });
});
