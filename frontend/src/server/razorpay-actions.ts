import { NextResponse } from "next/server";
import { getPrismaClient } from "@/server/prisma";
import {
  cancelRazorpaySubscription,
  fetchRazorpaySubscription,
  syncRazorpaySubscription,
} from "@/server/razorpay";

/** Stop renewals; the plan stays until the paid period ends, then the webhook downgrades it. */
export async function cancelRazorpayAtPeriodEnd(userId: string): Promise<NextResponse> {
  const prisma = getPrismaClient();
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      razorpay_subscription_id: true,
      subscription_provider: true,
      billing_period_end: true,
    },
  });
  if (!user?.razorpay_subscription_id || user.subscription_provider !== "razorpay") {
    return NextResponse.json({ error: "No active subscription to cancel" }, { status: 400 });
  }

  try {
    const current = await fetchRazorpaySubscription(user.razorpay_subscription_id);
    if (current.status === "pending" || current.status === "halted") {
      // A renewal is failing: end it now rather than keep retrying the charge.
      const cancelled = await cancelRazorpaySubscription(current.id, false);
      await syncRazorpaySubscription(cancelled);
      return NextResponse.json({ ok: true, ended: true });
    }
    if (current.status !== "active") {
      await syncRazorpaySubscription(current);
      return NextResponse.json({ ok: true, ended: true });
    }
    await cancelRazorpaySubscription(current.id, true);
    const endsAt =
      typeof current.current_end === "number" ? new Date(current.current_end * 1000) : user.billing_period_end;
    await prisma.user.update({
      where: { id: userId },
      data: { subscription_cancel_at: endsAt },
    });
    return NextResponse.json({ ok: true, cancel_at: endsAt?.toISOString() ?? null });
  } catch (error) {
    console.error("Razorpay cancellation failed", { userId, error });
    return NextResponse.json({ error: "We couldn't cancel the subscription. Please try again." }, { status: 502 });
  }
}

/**
 * Razorpay has no customer portal. While a renewal is failing, its hosted
 * subscription page lets the customer pay or authorise again.
 */
export async function razorpayPaymentPage(userId: string): Promise<NextResponse> {
  const user = await getPrismaClient().user.findUnique({
    where: { id: userId },
    select: { razorpay_subscription_id: true },
  });
  if (!user?.razorpay_subscription_id) {
    return NextResponse.json({ error: "No subscription found" }, { status: 400 });
  }
  try {
    const subscription = await fetchRazorpaySubscription(user.razorpay_subscription_id);
    if (subscription.short_url) return NextResponse.json({ url: subscription.short_url });
  } catch (error) {
    console.error("Razorpay subscription lookup failed", { userId, error });
  }
  return NextResponse.json(
    {
      error:
        "Razorpay retries failed payments automatically. If it keeps failing, cancel in Settings and subscribe again with another card or UPI.",
    },
    { status: 409 },
  );
}
