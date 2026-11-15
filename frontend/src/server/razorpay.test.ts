import crypto from "node:crypto";
import { fetchBackend } from "@/server/backend-api";
import { getPrismaClient } from "@/server/prisma";
import { restoreAffiliateProIfApproved } from "@/server/affiliates";
import {
  planForRazorpayPlanId,
  syncRazorpaySubscription,
  totalCountFor,
  verifySubscriptionPaymentSignature,
  verifyWebhookSignature,
} from "./razorpay";

vi.mock("@/server/prisma", () => ({ getPrismaClient: vi.fn() }));
vi.mock("@/server/backend-api", () => ({ fetchBackend: vi.fn() }));
vi.mock("@/server/affiliates", () => ({ restoreAffiliateProIfApproved: vi.fn() }));

const hmac = (secret: string, payload: string) =>
  crypto.createHmac("sha256", secret).update(payload).digest("hex");

describe("razorpay helpers", () => {
  const env = process.env;
  const user = { findUnique: vi.fn(), update: vi.fn(), updateMany: vi.fn() };

  beforeEach(() => {
    vi.resetAllMocks();
    process.env = {
      ...env,
      RAZORPAY_KEY_ID: "rzp_test_key",
      RAZORPAY_KEY_SECRET: "key_secret",
      RAZORPAY_WEBHOOK_SECRET: "hook_secret",
      RAZORPAY_PRO_PLAN_ID: "plan_pro_month",
      RAZORPAY_PRO_ANNUAL_PLAN_ID: "plan_pro_year",
      RAZORPAY_SCALE_PLAN_ID: "plan_scale_month",
    };
    vi.mocked(getPrismaClient).mockReturnValue({ user } as never);
    vi.mocked(fetchBackend).mockResolvedValue(new Response("{}", { status: 200 }));
    vi.mocked(restoreAffiliateProIfApproved).mockResolvedValue(false);
  });

  afterAll(() => {
    process.env = env;
  });

  it("accepts only the checkout signature made with the key secret", () => {
    const good = hmac("key_secret", "pay_1|sub_1");
    expect(verifySubscriptionPaymentSignature("pay_1", "sub_1", good)).toBe(true);
    expect(verifySubscriptionPaymentSignature("pay_1", "sub_2", good)).toBe(false);
    expect(verifySubscriptionPaymentSignature("pay_1", "sub_1", hmac("other", "pay_1|sub_1"))).toBe(false);
    expect(verifySubscriptionPaymentSignature("pay_1", "sub_1", "")).toBe(false);
  });

  it("verifies webhook bodies with the webhook secret", () => {
    const body = '{"event":"subscription.charged"}';
    expect(verifyWebhookSignature(body, hmac("hook_secret", body))).toBe(true);
    expect(verifyWebhookSignature(`${body} `, hmac("hook_secret", body))).toBe(false);
    expect(verifyWebhookSignature(body, hmac("hook_secret", body), null)).toBe(false);
  });

  it("maps configured plan ids to a plan and interval", () => {
    expect(planForRazorpayPlanId("plan_pro_month")).toEqual({ plan: "pro", interval: "month" });
    expect(planForRazorpayPlanId("plan_pro_year")).toEqual({ plan: "pro", interval: "year" });
    expect(planForRazorpayPlanId("plan_scale_month")).toEqual({ plan: "scale", interval: "month" });
    expect(planForRazorpayPlanId("plan_unknown")).toBeNull();
    expect(totalCountFor("month")).toBe(60);
    expect(totalCountFor("year")).toBe(5);
  });

  it("ignores subscriptions that are not the user's current one", async () => {
    user.findUnique.mockResolvedValue(null);
    await expect(syncRazorpaySubscription({ id: "sub_old", plan_id: "plan_pro_month", status: "active" })).resolves.toBe(
      "ignored",
    );
    expect(user.update).not.toHaveBeenCalled();
  });

  it("grants the plan and period when the subscription is active", async () => {
    user.findUnique.mockResolvedValue({ id: "u1", plan: "free", subscription_status: "inactive", subscription_provider: null });
    const outcome = await syncRazorpaySubscription({
      id: "sub_1",
      plan_id: "plan_scale_month",
      status: "active",
      current_start: 1_770_000_000,
      current_end: 1_772_592_000,
    });
    expect(outcome).toBe("granted");
    expect(user.update).toHaveBeenCalledWith({
      where: { id: "u1" },
      data: expect.objectContaining({
        plan: "scale",
        subscription_status: "active",
        subscription_provider: "razorpay",
        billing_period_start: new Date(1_770_000_000_000),
        billing_period_end: new Date(1_772_592_000_000),
      }),
    });
    expect(fetchBackend).toHaveBeenCalledTimes(1);
  });

  it("does not resend the welcome email on renewals", async () => {
    user.findUnique.mockResolvedValue({ id: "u1", plan: "pro", subscription_status: "active", subscription_provider: "razorpay" });
    await syncRazorpaySubscription({ id: "sub_1", plan_id: "plan_pro_month", status: "active" });
    expect(fetchBackend).not.toHaveBeenCalled();
  });

  it("keeps access as past_due while Razorpay retries a failed renewal", async () => {
    user.findUnique.mockResolvedValue({ id: "u1", plan: "pro", subscription_status: "active", subscription_provider: "razorpay" });
    await expect(syncRazorpaySubscription({ id: "sub_1", plan_id: "plan_pro_month", status: "pending" })).resolves.toBe(
      "past_due",
    );
    expect(user.update).toHaveBeenCalledWith({
      where: { id: "u1" },
      data: expect.objectContaining({ plan: "pro", subscription_status: "past_due" }),
    });
  });

  it.each(["halted", "cancelled", "completed", "expired"])("downgrades when the subscription is %s", async (status) => {
    user.findUnique.mockResolvedValue({ id: "u1", plan: "pro", subscription_status: "active", subscription_provider: "razorpay" });
    user.updateMany.mockResolvedValue({ count: 1 });
    await expect(syncRazorpaySubscription({ id: "sub_1", plan_id: "plan_pro_month", status })).resolves.toBe("downgraded");
    expect(user.updateMany).toHaveBeenCalledWith({
      where: { id: "u1", subscription_provider: "razorpay" },
      data: expect.objectContaining({ plan: "free", subscription_status: "inactive", subscription_provider: null }),
    });
  });

  it("does not grant anything before the first charge", async () => {
    user.findUnique.mockResolvedValue({ id: "u1", plan: "free", subscription_status: "inactive", subscription_provider: null });
    await expect(
      syncRazorpaySubscription({ id: "sub_1", plan_id: "plan_pro_month", status: "authenticated" }),
    ).resolves.toBe("unchanged");
    expect(user.update).not.toHaveBeenCalled();
    expect(user.updateMany).not.toHaveBeenCalled();
  });
});
