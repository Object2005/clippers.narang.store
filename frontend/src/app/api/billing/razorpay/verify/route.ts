import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { razorpayBillingEnabled } from "@/lib/billing-provider";
import { monetizationEnabled } from "@/lib/monetization";
import { getPrismaClient } from "@/server/prisma";
import {
  fetchRazorpaySubscription,
  fetchRazorpayPayment,
  syncRazorpaySubscription,
  verifySubscriptionPaymentSignature,
  verifyOrderPaymentSignature,
  sendSubscriptionEmail,
} from "@/server/razorpay";

/**
 * Called by the browser right after Razorpay Checkout succeeds, so the plan
 * unlocks immediately instead of waiting for the webhook.
 * Supports both Razorpay Orders (UPI, Snapmint, Cards, Netbanking) and Subscriptions (AutoPay).
 */
export async function POST(request: Request) {
  if (!monetizationEnabled || !razorpayBillingEnabled()) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: {
    razorpay_payment_id?: unknown;
    razorpay_subscription_id?: unknown;
    razorpay_order_id?: unknown;
    razorpay_signature?: unknown;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const paymentId = typeof body.razorpay_payment_id === "string" ? body.razorpay_payment_id : "";
  const subscriptionId = typeof body.razorpay_subscription_id === "string" ? body.razorpay_subscription_id : "";
  const orderId = typeof body.razorpay_order_id === "string" ? body.razorpay_order_id : "";
  const signature = typeof body.razorpay_signature === "string" ? body.razorpay_signature : "";

  if (!paymentId || !signature) {
    return NextResponse.json({ error: "Missing payment details" }, { status: 400 });
  }

  const prisma = getPrismaClient();

  // 1. Standard Razorpay Order Verification (Google Pay, PhonePe, Paytm, Snapmint, Cards, Netbanking)
  if (orderId) {
    if (!verifyOrderPaymentSignature(paymentId, orderId, signature)) {
      return NextResponse.json({ error: "Payment signature is invalid" }, { status: 400 });
    }

    try {
      const payment = await fetchRazorpayPayment(paymentId);
      if (payment.status !== "captured" && payment.status !== "authorized") {
        return NextResponse.json({ error: "Payment was not successful" }, { status: 400 });
      }

      const notes = (payment.notes || {}) as Record<string, string>;
      const targetPlan = notes.plan === "scale" ? "scale" : "pro";
      const interval = notes.interval === "year" ? "year" : "month";
      const durationDays = interval === "year" ? 365 : 30;
      const startDate = new Date();
      const endDate = new Date(Date.now() + durationDays * 24 * 60 * 60 * 1000);

      await prisma.user.update({
        where: { id: session.user.id },
        data: {
          plan: targetPlan,
          subscription_status: "active",
          subscription_provider: "razorpay",
          billing_period_start: startDate,
          billing_period_end: endDate,
          trial_ends_at: null,
          subscription_cancel_at: null,
        },
      });

      // Send email notification on purchase
      try {
        await sendSubscriptionEmail(session.user.id, "subscribed");
      } catch (emailErr) {
        console.error("Failed to send subscription confirmation email:", emailErr);
      }

      return NextResponse.json({ ok: true, status: payment.status, plan: targetPlan, interval, period_end: endDate });
    } catch (err) {
      console.error("Order payment verification failed", { orderId, paymentId, err });
      return NextResponse.json({ error: "We couldn't confirm the payment with Razorpay" }, { status: 500 });
    }
  }

  // 2. Razorpay Subscription Verification (Recurring UPI AutoPay / e-Mandate)
  if (subscriptionId) {
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { razorpay_subscription_id: true },
    });
    if (user?.razorpay_subscription_id !== subscriptionId) {
      return NextResponse.json({ error: "This payment is not for your account" }, { status: 403 });
    }
    if (!verifySubscriptionPaymentSignature(paymentId, subscriptionId, signature)) {
      return NextResponse.json({ error: "Payment signature is invalid" }, { status: 400 });
    }

    try {
      const subscription = await fetchRazorpaySubscription(subscriptionId);
      const outcome = await syncRazorpaySubscription(subscription);
      return NextResponse.json({ ok: true, status: subscription.status, outcome });
    } catch (error) {
      console.error("Razorpay verify failed", { subscriptionId, error });
      return NextResponse.json({ ok: true, status: "processing" });
    }
  }

  return NextResponse.json({ error: "Neither order_id nor subscription_id provided" }, { status: 400 });
}
