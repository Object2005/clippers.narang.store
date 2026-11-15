import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { razorpayBillingEnabled } from "@/lib/billing-provider";
import { monetizationEnabled } from "@/lib/monetization";
import { getPrismaClient } from "@/server/prisma";
import {
  fetchRazorpaySubscription,
  syncRazorpaySubscription,
  verifySubscriptionPaymentSignature,
} from "@/server/razorpay";

/**
 * Called by the browser right after Razorpay Checkout succeeds, so the plan
 * unlocks immediately instead of waiting for the webhook.
 */
export async function POST(request: Request) {
  if (!monetizationEnabled || !razorpayBillingEnabled()) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { razorpay_payment_id?: unknown; razorpay_subscription_id?: unknown; razorpay_signature?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const paymentId = typeof body.razorpay_payment_id === "string" ? body.razorpay_payment_id : "";
  const subscriptionId = typeof body.razorpay_subscription_id === "string" ? body.razorpay_subscription_id : "";
  const signature = typeof body.razorpay_signature === "string" ? body.razorpay_signature : "";
  if (!paymentId || !subscriptionId || !signature) {
    return NextResponse.json({ error: "Missing payment details" }, { status: 400 });
  }

  const user = await getPrismaClient().user.findUnique({
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
    // "unchanged" means Razorpay has the mandate but has not activated it yet;
    // the webhook grants the plan as soon as it does.
    return NextResponse.json({ ok: true, status: subscription.status, outcome });
  } catch (error) {
    console.error("Razorpay verify failed", { subscriptionId, error });
    return NextResponse.json({ ok: true, status: "processing" });
  }
}
