export interface CouponInfo {
  code: string;
  discountPercent: number; // e.g. 10, 20, 50
  title: string;
  description: string;
}

export const ACTIVE_PROMO_COUPONS: Record<string, CouponInfo> = {
  XMAS10: {
    code: "XMAS10",
    discountPercent: 10,
    title: "Christmas 10% Discount",
    description: "10% off on all membership plans",
  },
  CHRISTMAS10: {
    code: "CHRISTMAS10",
    discountPercent: 10,
    title: "Christmas 10% Discount",
    description: "10% off on all membership plans",
  },
  NEWYEAR20: {
    code: "NEWYEAR20",
    discountPercent: 20,
    title: "New Year 20% Discount",
    description: "20% off on all membership plans",
  },
  HOLIDAY20: {
    code: "HOLIDAY20",
    discountPercent: 20,
    title: "Holiday 20% Discount",
    description: "20% off on all membership plans",
  },
  SPECIAL50: {
    code: "SPECIAL50",
    discountPercent: 50,
    title: "Special 50% Mega Discount",
    description: "50% off on all membership plans",
  },
  HALF50: {
    code: "HALF50",
    discountPercent: 50,
    title: "Half Price 50% Discount",
    description: "50% off on all membership plans",
  },
};

export function getPromoCoupon(rawCode: string | null | undefined): CouponInfo | null {
  if (!rawCode) return null;
  const normalized = rawCode.trim().toUpperCase();
  return ACTIVE_PROMO_COUPONS[normalized] || null;
}

export function applyCouponDiscount(price: number, discountPercent: number): number {
  if (discountPercent >= 90) return Math.round(price * 0.1); // Max discount 90%, payment always required
  if (discountPercent <= 0) return price;
  return Math.max(100, Math.round(price * (1 - discountPercent / 100))); // At least ₹1 (100 paise)
}
