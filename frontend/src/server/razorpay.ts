import crypto from "node:crypto";
import { buildBackendAuthHeaders } from "@/lib/backend-auth";
import type { BillingInterval } from "@/lib/billing-plans";
import { restoreAffiliateProIfApproved } from "@/server/affiliates";
import { fetchBackend } from "@/server/backend-api";
import { getPrismaClient } from "@/server/prisma";

/**
 * Razorpay Subscriptions for hosted billing (NEXT_PUBLIC_BILLING_PROVIDER=razorpay).
 *
 * Flow: checkout creates a subscription for the chosen plan and the browser
 * opens Razorpay Checkout with its id. After the customer authorises the
 * mandate, /api/billing/razorpay/verify checks the payment signature and the
 * webhook keeps the plan in step on every renewal, failure and cancellation.
 * Both read the subscription back from Razorpay before changing the user, so
 * an out-of-order or replayed event can never set a stale state.
 */

export type RazorpayPlanId = "pro" | "scale";

export type RazorpaySubscription = {
  id: string;
  plan_id: string;
  status: string;
  current_start?: number | null;
  current_end?: number | null;
  ended_at?: number | null;
  short_url?: string | null;
  notes?: Record<string, string> | unknown[] | null;
};

export class RazorpayApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "RazorpayApiError";
  }
}

const PLAN_ENV: Record<RazorpayPlanId, Record<BillingInterval, string>> = {
  pro: { month: "RAZORPAY_PRO_PLAN_ID", year: "RAZORPAY_PRO_ANNUAL_PLAN_ID" },
  scale: { month: "RAZORPAY_SCALE_PLAN_ID", year: "RAZORPAY_SCALE_ANNUAL_PLAN_ID" },
};

/** Statuses that keep the plan: `pending` means Razorpay is still retrying a failed renewal. */
const GRANTING_STATUSES = new Set(["active", "pending"]);
/** Statuses after which the subscription can no longer charge. */
const ENDED_STATUSES = new Set(["halted", "cancelled", "completed", "expired", "paused"]);

function env(name: string): string | null {
  return process.env[name]?.trim() || null;
}

export function razorpayConfigured(): boolean {
  return Boolean(env("RAZORPAY_KEY_ID") && env("RAZORPAY_KEY_SECRET"));
}

export function razorpayKeyId(): string {
  const keyId = env("RAZORPAY_KEY_ID");
  if (!keyId) throw new Error("RAZORPAY_KEY_ID is not configured");
  return keyId;
}

function razorpayKeySecret(): string {
  const secret = env("RAZORPAY_KEY_SECRET");
  if (!secret) throw new Error("RAZORPAY_KEY_SECRET is not configured");
  return secret;
}

export function razorpayPlanIdFor(plan: RazorpayPlanId, interval: BillingInterval): string | null {
  return env(PLAN_ENV[plan][interval]);
}

/** Which of our plans and intervals a Razorpay plan id sells, or null for an unknown plan. */
export function planForRazorpayPlanId(
  planId: string | null | undefined,
): { plan: RazorpayPlanId; interval: BillingInterval } | null {
  if (!planId) return null;
  for (const plan of Object.keys(PLAN_ENV) as RazorpayPlanId[]) {
    for (const interval of ["month", "year"] as BillingInterval[]) {
      if (razorpayPlanIdFor(plan, interval) === planId) return { plan, interval };
    }
  }
  return null;
}

/** Billing cycles to authorise up front (Razorpay needs a finite count). */
export function totalCountFor(interval: BillingInterval): number {
  const name = interval === "year" ? "RAZORPAY_TOTAL_COUNT_YEARLY" : "RAZORPAY_TOTAL_COUNT_MONTHLY";
  const parsed = Number.parseInt(env(name) ?? "", 10);
  if (Number.isFinite(parsed) && parsed > 0) return parsed;
  return interval === "year" ? 5 : 60;
}

function hmacHex(secret: string, payload: string): string {
  return crypto.createHmac("sha256", secret).update(payload).digest("hex");
}

function safeEqualHex(actual: string | null | undefined, expected: string): boolean {
  if (!actual) return false;
  const a = Buffer.from(actual, "utf8");
  const b = Buffer.from(expected, "utf8");
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

/** Signature Checkout returns after the customer authorises a subscription. */
export function verifySubscriptionPaymentSignature(
  paymentId: string,
  subscriptionId: string,
  signature: string | null | undefined,
  secret: string = razorpayKeySecret(),
): boolean {
  return safeEqualHex(signature, hmacHex(secret, `${paymentId}|${subscriptionId}`));
}

/** `X-Razorpay-Signature` on webhooks: HMAC-SHA256 of the raw body with the webhook secret. */
export function verifyWebhookSignature(
  rawBody: string,
  signature: string | null | undefined,
  secret: string | null = env("RAZORPAY_WEBHOOK_SECRET"),
): boolean {
  if (!secret) return false;
  return safeEqualHex(signature, hmacHex(secret, rawBody));
}

async function razorpayRequest<T>(path: string, init: { method: string; body?: unknown }): Promise<T> {
  const base = env("RAZORPAY_API_BASE") ?? "https://api.razorpay.com/v1";
  const auth = Buffer.from(`${razorpayKeyId()}:${razorpayKeySecret()}`).toString("base64");
  const response = await fetch(`${base}${path}`, {
    method: init.method,
    headers: {
      Authorization: `Basic ${auth}`,
      ...(init.body === undefined ? {} : { "Content-Type": "application/json" }),
    },
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
    cache: "no-store",
  });
  const text = await response.text();
  let data: unknown = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = null;
  }
  if (!response.ok) {
    const description =
      (data as { error?: { description?: string } } | null)?.error?.description || `HTTP ${response.status}`;
    throw new RazorpayApiError(`Razorpay ${init.method} ${path} failed: ${description}`, response.status);
  }
  return data as T;
}

export function createRazorpaySubscription(input: {
  planId: string;
  totalCount: number;
  userId: string;
  email: string;
}): Promise<RazorpaySubscription> {
  return razorpayRequest<RazorpaySubscription>("/subscriptions", {
    method: "POST",
    body: {
      plan_id: input.planId,
      total_count: input.totalCount,
      quantity: 1,
      customer_notify: 1,
      notes: { user_id: input.userId, email: input.email, app: "gtaclipper" },
    },
  });
}

export function fetchRazorpaySubscription(id: string): Promise<RazorpaySubscription> {
  return razorpayRequest<RazorpaySubscription>(`/subscriptions/${encodeURIComponent(id)}`, { method: "GET" });
}

export function cancelRazorpaySubscription(id: string, atCycleEnd: boolean): Promise<RazorpaySubscription> {
  return razorpayRequest<RazorpaySubscription>(`/subscriptions/${encodeURIComponent(id)}/cancel`, {
    method: "POST",
    body: { cancel_at_cycle_end: atCycleEnd ? 1 : 0 },
  });
}

function fromUnix(seconds: number | null | undefined): Date | null {
  return typeof seconds === "number" && Number.isFinite(seconds) && seconds > 0 ? new Date(seconds * 1000) : null;
}

async function sendSubscriptionEmail(userId: string, event: "subscribed" | "unsubscribed") {
  try {
    const response = await fetchBackend("/billing/subscription-email", {
      method: "POST",
      userId,
      extraHeaders: { ...buildBackendAuthHeaders(userId), "Content-Type": "application/json" },
      body: JSON.stringify({ event }),
      cache: "no-store",
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
  } catch (error) {
    console.error("Razorpay subscription email failed", { userId, event, error });
  }
}

export type RazorpaySyncOutcome = "ignored" | "granted" | "past_due" | "downgraded" | "creator_pro" | "unchanged";

/**
 * Copy one Razorpay subscription's state onto the user who owns it. Only the
 * user whose current subscription this is changes, so events for a replaced
 * subscription are ignored.
 */
export async function syncRazorpaySubscription(subscription: RazorpaySubscription): Promise<RazorpaySyncOutcome> {
  const prisma = getPrismaClient();
  const user = await prisma.user.findUnique({
    where: { razorpay_subscription_id: subscription.id },
    select: { id: true, plan: true, subscription_status: true, subscription_provider: true },
  });
  if (!user) return "ignored";

  const status = subscription.status;
  if (GRANTING_STATUSES.has(status)) {
    const mapped = planForRazorpayPlanId(subscription.plan_id);
    if (!mapped) {
      console.warn("Razorpay subscription has an unknown plan", {
        subscriptionId: subscription.id,
        planId: subscription.plan_id,
      });
      return "ignored";
    }
    const wasPaid =
      user.subscription_provider === "razorpay" && ["active", "past_due"].includes(user.subscription_status);
    await prisma.user.update({
      where: { id: user.id },
      data: {
        plan: mapped.plan,
        subscription_status: status === "pending" ? "past_due" : "active",
        subscription_provider: "razorpay",
        billing_period_start: fromUnix(subscription.current_start),
        billing_period_end: fromUnix(subscription.current_end),
        trial_ends_at: null,
        pending_plan: null,
        pending_plan_invoice_id: null,
      },
    });
    if (status === "pending") return "past_due";
    if (!wasPaid) await sendSubscriptionEmail(user.id, "subscribed");
    return "granted";
  }

  if (ENDED_STATUSES.has(status)) {
    const result = await prisma.user.updateMany({
      where: { id: user.id, subscription_provider: "razorpay" },
      data: {
        plan: "free",
        subscription_status: "inactive",
        subscription_provider: null,
        billing_period_start: null,
        billing_period_end: null,
        trial_ends_at: null,
        subscription_cancel_at: null,
        legacy_hd: false,
      },
    });
    if (result.count === 0) return "unchanged";
    if (await restoreAffiliateProIfApproved(prisma, user.id)) return "creator_pro";
    await sendSubscriptionEmail(user.id, "unsubscribed");
    return "downgraded";
  }

  // created / authenticated: the mandate is not charged yet, nothing to grant.
  return "unchanged";
}
