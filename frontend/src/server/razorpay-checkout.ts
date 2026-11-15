import { NextResponse } from "next/server";
import type { BillingInterval } from "@/lib/billing-plans";
import { SITE_NAME } from "@/lib/site";
import { getPrismaClient } from "@/server/prisma";
import {
  RazorpayApiError,
  createRazorpaySubscription,
  razorpayConfigured,
  razorpayKeyId,
  razorpayPlanIdFor,
  totalCountFor,
  type RazorpayPlanId,
} from "@/server/razorpay";

/** What the browser needs to open Razorpay Checkout for a new subscription. */
export type RazorpayCheckoutOptions = {
  key: string;
  subscription_id: string;
  name: string;
  description: string;
  prefill: { email: string; name?: string };
};

const SUBSCRIBED_STATUSES = new Set(["active", "trialing", "past_due"]);

export async function razorpayCheckout(
  user: { id: string; email: string; name?: string | null },
  requestedPlan: string,
  interval: BillingInterval,
): Promise<NextResponse> {
  if (requestedPlan !== "pro" && requestedPlan !== "scale") {
    return NextResponse.json({ error: "Unknown billing plan" }, { status: 400 });
  }
  if (!razorpayConfigured()) {
    return NextResponse.json({ error: "Payments are not configured yet" }, { status: 503 });
  }
  const plan: RazorpayPlanId = requestedPlan;
  const planId = razorpayPlanIdFor(plan, interval);
  if (!planId) {
    return NextResponse.json(
      { error: `The ${interval === "year" ? "yearly" : "monthly"} ${plan} plan is not available` },
      { status: 400 },
    );
  }

  const prisma = getPrismaClient();
  const current = await prisma.user.findUnique({
    where: { id: user.id },
    select: { plan: true, subscription_status: true, subscription_provider: true },
  });
  // One live subscription per account: a second one would bill twice. Plan
  // changes go through cancelling and subscribing again after the period ends.
  if (current && current.plan !== "free" && SUBSCRIBED_STATUSES.has(current.subscription_status)) {
    const message =
      current.subscription_provider === "razorpay"
        ? "You already have an active subscription. Cancel it in Settings to switch plans when it ends."
        : "You already have an active plan.";
    return NextResponse.json({ error: message, code: "already_subscribed" }, { status: 409 });
  }

  try {
    const subscription = await createRazorpaySubscription({
      planId,
      totalCount: totalCountFor(interval),
      userId: user.id,
      email: user.email,
    });
    await prisma.user.update({
      where: { id: user.id },
      data: { razorpay_subscription_id: subscription.id, subscription_cancel_at: null },
    });
    const options: RazorpayCheckoutOptions = {
      key: razorpayKeyId(),
      subscription_id: subscription.id,
      name: SITE_NAME,
      description: `${plan === "scale" ? "Creator" : "Pro"} plan, billed ${interval === "year" ? "yearly" : "monthly"}`,
      prefill: { email: user.email, ...(user.name ? { name: user.name } : {}) },
    };
    return NextResponse.json({ razorpay: options });
  } catch (error) {
    console.error("Razorpay subscription creation failed", error);
    const status = error instanceof RazorpayApiError && error.status < 500 ? 400 : 502;
    return NextResponse.json({ error: "We couldn't start the payment. Please try again." }, { status });
  }
}
