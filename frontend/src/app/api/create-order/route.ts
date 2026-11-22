import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const keyId = process.env.RAZORPAY_KEY_ID;
    const keySecret = process.env.RAZORPAY_KEY_SECRET;

    if (!keyId || !keySecret) {
      return NextResponse.json(
        { error: "Razorpay credentials are not configured on the server" },
        { status: 500 }
      );
    }

    let body: { amount?: number; currency?: string; receipt?: string; notes?: Record<string, string> } = {};
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON request body" }, { status: 400 });
    }

    const { amount, currency = "INR", receipt, notes } = body;

    // STEP 1 Validation: Minimum amount 100 paise
    if (typeof amount !== "number" || isNaN(amount) || amount < 100) {
      return NextResponse.json(
        { error: "Amount must be a valid number and at least 100 paise (₹1.00)" },
        { status: 400 }
      );
    }

    const orderPayload = {
      amount: Math.round(amount),
      currency: currency.toUpperCase(),
      receipt: receipt || `rcpt_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      ...(notes ? { notes } : {}),
    };

    const basicAuth = Buffer.from(`${keyId}:${keySecret}`).toString("base64");
    const response = await fetch("https://api.razorpay.com/v1/orders", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Basic ${basicAuth}`,
      },
      body: JSON.stringify(orderPayload),
    });

    const data = await response.json().catch(() => null);

    if (!response.ok) {
      console.error("Razorpay order creation failed:", response.status, data);
      if (response.status === 401) {
        return NextResponse.json(
          { error: "Razorpay authentication failed: Invalid Key ID or Key Secret" },
          { status: 401 }
        );
      }
      return NextResponse.json(
        { error: data?.error?.description || "Failed to create Razorpay order" },
        { status: response.status >= 500 ? 500 : 400 }
      );
    }

    // Return specified fields: order_id, amount, currency
    return NextResponse.json({
      order_id: data.id,
      amount: data.amount,
      currency: data.currency,
      key_id: keyId, // Provide public key to client if requested
    });
  } catch (error) {
    console.error("Internal error in /api/create-order:", error);
    return NextResponse.json(
      { error: "Internal server error while creating order" },
      { status: 500 }
    );
  }
}
