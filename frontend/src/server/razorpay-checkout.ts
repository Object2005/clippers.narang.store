import { NextResponse } from "next/server";
import { type BillingInterval } from "@/lib/billing-plans";
import { SITE_NAME } from "@/lib/site";
import { getPrismaClient } from "@/server/prisma";
import { getPromoCoupon, applyCouponDiscount } from "@/lib/coupons";
import { findCreatorOffer } from "@/server/affiliates";
import {
  RazorpayApiError,
  createRazorpaySubscription,
  createRazorpayOrder,
  planPriceInPaise,
  razorpayConfigured,
  razorpayKeyId,
  razorpayPlanIdFor,
  totalCountFor,
  type RazorpayPlanId,
} from "@/server/razorpay";

/** What the browser needs to open Razorpay Checkout for a new order or subscription. */
export type RazorpayCheckoutOptions = {
  key: string;
  order_id?: string;
  subscription_id?: string;
  amount?: number;
  currency?: string;
  name: string;
  description: string;
  prefill: { email: string; name?: string };
};

const SUBSCRIBED_STATUSES = new Set(["active", "trialing", "past_due"]);

export async function razorpayCheckout(
  user: { id: string; email: string; name?: string | null },
  requestedPlan: string,
  interval: BillingInterval,
  enteredCode?: string | null,
): Promise<NextResponse> {
  if (requestedPlan !== "pro" && requestedPlan !== "scale") {
    return NextResponse.json({ error: "Unknown billing plan" }, { status: 400 });
  }

  // Strictly enforce real payments. Never grant free access without payment.
  if (!razorpayConfigured()) {
    return NextResponse.json(
      {
        error: "Payment gateway is being configured. Please contact support at nbms@narang.store to activate your plan.",
        code: "razorpay_not_configured",
      },
      { status: 503 },
    );
  }

  const plan: RazorpayPlanId = requestedPlan;
  const prisma = getPrismaClient();
  const current = await prisma.user.findUnique({
    where: { id: user.id },
    select: { plan: true, subscription_status: true, subscription_provider: true },
  });

  // One live subscription per account: a second one would bill twice.
  if (current && current.plan !== "free" && SUBSCRIBED_STATUSES.has(current.subscription_status)) {
    const message =
      current.subscription_provider === "razorpay"
        ? "You already have an active subscription. Cancel it in Settings to switch plans when it ends."
        : "You already have an active plan.";
    return NextResponse.json({ error: message, code: "already_subscribed" }, { status: 409 });
  }

  // 1. If a recurring subscription plan ID is configured, try creating a subscription with a 7-day trial.
  const planId = razorpayPlanIdFor(plan, interval);
  if (planId) {
    try {
      const trialDays = 7;
      const startAt = Math.floor(Date.now() / 1000) + trialDays * 24 * 60 * 60;
      const subscription = await createRazorpaySubscription({
        planId,
        totalCount: totalCountFor(interval),
        userId: user.id,
        email: user.email,
        startAt,
      });
      await prisma.user.update({
        where: { id: user.id },
        data: { razorpay_subscription_id: subscription.id, subscription_cancel_at: null },
      });
      const options: RazorpayCheckoutOptions = {
        key: razorpayKeyId(),
        subscription_id: subscription.id,
        name: SITE_NAME,
        description: `${plan === "scale" ? "Creator" : "Pro"} Plan - 7-Day Free Trial, then UPI AutoPay`,
        prefill: { email: user.email, ...(user.name ? { name: user.name } : {}) },
      };
      return NextResponse.json({ razorpay: options });
    } catch (subErr) {
      console.warn("Razorpay subscription creation failed, falling back to direct order:", subErr);
      // Fall through to order checkout
    }
  }

  // 2. Direct Order Checkout (Supports Google Pay, PhonePe, Paytm, Snapmint EMI, Cards, Netbanking)
  try {
    let amountPaise = planPriceInPaise(plan, interval);
    let discountPercent = 0;
    let promoTitle = "";

    if (enteredCode) {
      const promo = getPromoCoupon(enteredCode);
      if (promo) {
        discountPercent = promo.discountPercent;
        promoTitle = promo.title;
      } else {
        try {
          const offer = await findCreatorOffer(prisma, enteredCode);
          if (offer) {
            discountPercent = 20;
            promoTitle = "Creator 20% Discount";
          }
        } catch {
          // ignore
        }
      }
    }

    if (discountPercent > 0) {
      amountPaise = applyCouponDiscount(amountPaise, discountPercent);
    }

    const order = await createRazorpayOrder({
      amount: amountPaise,
      currency: "INR",
      receipt: `clp_${user.id.slice(0, 8)}_${Date.now().toString(36)}`,
      notes: {
        userId: user.id,
        email: user.email,
        plan,
        interval,
        appName: SITE_NAME,
        couponCode: enteredCode || "",
        discountPercent: discountPercent.toString(),
      },
    });

    const options: RazorpayCheckoutOptions = {
      key: razorpayKeyId(),
      order_id: order.id,
      amount: order.amount,
      currency: order.currency,
      name: SITE_NAME,
      description: `${plan === "scale" ? "Creator" : "Pro"} Plan${promoTitle ? ` (${promoTitle})` : ""} - ₹${(amountPaise / 100).toLocaleString("en-IN")} (UPI, Snapmint, Cards)`,
      prefill: { email: user.email, ...(user.name ? { name: user.name } : {}) },
    };
    return NextResponse.json({ razorpay: options });
  } catch (error) {
    console.error("Razorpay order creation failed", error);
    const status = error instanceof RazorpayApiError && error.status < 500 ? 400 : 502;
    return NextResponse.json(
      { error: "We couldn't start the payment gateway. Please try again or contact nbms@narang.store" },
      { status },
    );
  }
}
