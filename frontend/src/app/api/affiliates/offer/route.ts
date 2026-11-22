import { NextResponse } from "next/server";
import { findCreatorOffer } from "@/server/affiliates";
import { getPrismaClient } from "@/server/prisma";
import { getPromoCoupon } from "@/lib/coupons";

/** Public: whether `?code=maya` or coupon (e.g. `XMAS10`, `FREE100`) is valid. */
export async function GET(request: Request) {
  try {
    const rawCode = new URL(request.url).searchParams.get("code") ?? "";
    const promo = getPromoCoupon(rawCode);
    if (promo) {
      return NextResponse.json({
        code: promo.code,
        discount: promo.discountPercent,
        description: promo.description,
      });
    }

    try {
      const offer = await findCreatorOffer(getPrismaClient(), rawCode);
      if (offer) {
        return NextResponse.json({ code: offer.code, discount: 20 });
      }
    } catch {
      // Creator table lookup optional
    }

    return NextResponse.json({ error: "Invalid coupon or discount code", valid: false }, { status: 404 });
  } catch (error) {
    console.error("Failed to look up code:", error);
    return NextResponse.json({ error: "Invalid coupon code", valid: false }, { status: 400 });
  }
}
