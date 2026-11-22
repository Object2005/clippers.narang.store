import { getPrismaClient } from "@/server/prisma";
import { razorpayCheckout } from "./razorpay-checkout";

vi.mock("@/server/prisma", () => ({ getPrismaClient: vi.fn() }));
vi.mock("@/server/affiliates", () => ({ restoreAffiliateProIfApproved: vi.fn() }));
vi.mock("@/server/backend-api", () => ({ fetchBackend: vi.fn() }));

describe("razorpayCheckout", () => {
  const env = process.env;
  const realFetch = global.fetch;
  const user = { findUnique: vi.fn(), update: vi.fn() };
  const buyer = { id: "u1", email: "a@example.com", name: "Asha" };

  beforeEach(() => {
    vi.clearAllMocks();
    process.env = {
      ...env,
      RAZORPAY_KEY_ID: "rzp_test_key",
      RAZORPAY_KEY_SECRET: "key_secret",
      RAZORPAY_PRO_PLAN_ID: "plan_pro_month",
    };
    vi.mocked(getPrismaClient).mockReturnValue({ user } as never);
    user.findUnique.mockResolvedValue({ plan: "free", subscription_status: "inactive", subscription_provider: null });
    global.fetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ id: "sub_new", plan_id: "plan_pro_month", status: "created" }), { status: 200 }),
    ) as typeof fetch;
  });

  afterAll(() => {
    process.env = env;
    global.fetch = realFetch;
  });

  it("creates a subscription, remembers it and returns checkout options", async () => {
    const response = await razorpayCheckout(buyer, "pro", "month");
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.razorpay).toMatchObject({ key: "rzp_test_key", subscription_id: "sub_new", prefill: { email: "a@example.com" } });

    const [url, init] = vi.mocked(global.fetch).mock.calls[0];
    expect(url).toBe("https://api.razorpay.com/v1/subscriptions");
    expect(JSON.parse(String((init as RequestInit).body))).toMatchObject({
      plan_id: "plan_pro_month",
      total_count: 60,
      notes: { user_id: "u1" },
    });
    expect(user.update).toHaveBeenCalledWith({
      where: { id: "u1" },
      data: { razorpay_subscription_id: "sub_new", subscription_cancel_at: null },
    });
  });

  it("refuses a second subscription while one is active", async () => {
    user.findUnique.mockResolvedValue({ plan: "pro", subscription_status: "active", subscription_provider: "razorpay" });
    const response = await razorpayCheckout(buyer, "pro", "month");
    expect(response.status).toBe(409);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("refuses checkout when razorpay is not configured (no free sandbox bypass)", async () => {
    delete process.env.RAZORPAY_KEY_ID;
    delete process.env.RAZORPAY_KEY_SECRET;
    const response = await razorpayCheckout(buyer, "pro", "month");
    expect(response.status).toBe(503);
    expect(user.update).not.toHaveBeenCalled();
  });

  it("creates a direct order for Google Pay, PhonePe, Snapmint when subscription plan id is omitted", async () => {
    global.fetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ id: "order_123", amount: 349900, currency: "INR", status: "created" }), { status: 200 }),
    ) as typeof fetch;
    const response = await razorpayCheckout(buyer, "scale", "month");
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.razorpay).toMatchObject({
      key: "rzp_test_key",
      order_id: "order_123",
      amount: 349900,
      currency: "INR",
      prefill: { email: "a@example.com" },
    });
  });
});
