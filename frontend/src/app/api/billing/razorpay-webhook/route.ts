import crypto from "node:crypto";
import { NextResponse } from "next/server";
import { getPrismaClient } from "@/server/prisma";
import {
  fetchRazorpaySubscription,
  syncRazorpaySubscription,
  verifyWebhookSignature,
} from "@/server/razorpay";

type RazorpayWebhookBody = {
  event?: string;
  payload?: {
    subscription?: { entity?: { id?: string } };
  };
};

/**
 * Razorpay → Dashboard → Webhooks: point it at /api/billing/razorpay-webhook
 * with the subscription.* events and the secret in RAZORPAY_WEBHOOK_SECRET.
 */
export async function POST(request: Request) {
  if (!process.env.RAZORPAY_WEBHOOK_SECRET?.trim()) {
    return NextResponse.json({ error: "Razorpay webhook secret is not configured" }, { status: 503 });
  }

  const rawBody = await request.text();
  if (!verifyWebhookSignature(rawBody, request.headers.get("x-razorpay-signature"))) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  let body: RazorpayWebhookBody;
  try {
    body = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const eventType = body.event || "unknown";
  const subscriptionId = body.payload?.subscription?.entity?.id;
  if (!eventType.startsWith("subscription.") || !subscriptionId) {
    return NextResponse.json({ ok: true, ignored: true });
  }

  const eventId =
    request.headers.get("x-razorpay-event-id") ||
    crypto.createHash("sha256").update(rawBody).digest("hex");
  const prisma = getPrismaClient();
  try {
    await prisma.razorpayWebhookEvent.create({ data: { id: eventId, type: eventType } });
  } catch (error) {
    if ((error as { code?: string }).code === "P2002") {
      return NextResponse.json({ ok: true, duplicate: true });
    }
    throw error;
  }

  try {
    // The payload can arrive out of order; Razorpay's current state is the truth.
    const subscription = await fetchRazorpaySubscription(subscriptionId);
    const outcome = await syncRazorpaySubscription(subscription);
    return NextResponse.json({ ok: true, outcome });
  } catch (error) {
    // Forget the event so Razorpay's retry is processed.
    await prisma.razorpayWebhookEvent.delete({ where: { id: eventId } }).catch(() => {});
    console.error("Razorpay webhook handler failed", { eventId, eventType, subscriptionId, error });
    return NextResponse.json({ error: "Razorpay webhook handler failed" }, { status: 500 });
  }
}
