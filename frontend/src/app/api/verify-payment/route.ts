import { NextResponse } from "next/server";
import crypto from "node:crypto";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";

export async function POST(request: Request) {
  try {
    const keySecret = process.env.RAZORPAY_KEY_SECRET;

    if (!keySecret) {
      return NextResponse.json(
        { error: "Razorpay Key Secret is not configured on the server" },
        { status: 500 }
      );
    }

    let body: {
      razorpay_order_id?: string;
      razorpay_payment_id?: string;
      razorpay_signature?: string;
      plan?: string;
    } = {};

    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON request body" }, { status: 400 });
    }

    const { razorpay_order_id, razorpay_payment_id, razorpay_signature, plan = "pro" } = body;

    // Validate required fields
    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return NextResponse.json(
        {
          error: "Missing required fields: razorpay_order_id, razorpay_payment_id, and razorpay_signature are required",
        },
        { status: 400 }
      );
    }

    // STEP 3: Algorithm: HMAC-SHA256(order_id + "|" + payment_id, KEY_SECRET)
    const payload = `${razorpay_order_id}|${razorpay_payment_id}`;
    const generatedSignature = crypto
      .createHmac("sha256", keySecret)
      .update(payload)
      .digest("hex");

    // Timing-safe comparison to prevent timing attacks
    const sigBufferA = Buffer.from(generatedSignature, "utf8");
    const sigBufferB = Buffer.from(razorpay_signature, "utf8");
    const isSignatureValid =
      sigBufferA.length === sigBufferB.length &&
      crypto.timingSafeEqual(sigBufferA, sigBufferB);

    if (!isSignatureValid) {
      return NextResponse.json(
        {
          success: false,
          error: "Invalid payment signature. Verification failed.",
        },
        { status: 400 }
      );
    }

    // If an authenticated user made the payment, update their membership in the database
    try {
      const session = await auth.api.getSession({ headers: await headers() });
      if (session?.user?.id) {
        const startDate = new Date();
        const endDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days
        await prisma.user.update({
          where: { id: session.user.id },
          data: {
            plan,
            subscription_status: "active",
            subscription_provider: "razorpay",
            billing_period_start: startDate,
            billing_period_end: endDate,
            trial_ends_at: null,
            subscription_cancel_at: null,
          },
        });
      }
    } catch (sessionErr) {
      // Optional database association failure shouldn't fail verification
      console.warn("Could not associate payment with user session:", sessionErr);
    }

    return NextResponse.json({
      success: true,
      message: "Payment verified successfully",
      payment_id: razorpay_payment_id,
      order_id: razorpay_order_id,
    });
  } catch (error) {
    console.error("Internal error in /api/verify-payment:", error);
    return NextResponse.json(
      { error: "Internal server error while verifying payment" },
      { status: 500 }
    );
  }
}
