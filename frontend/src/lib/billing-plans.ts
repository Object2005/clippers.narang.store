import type { SupportedCurrency } from "./billing-provider";

export type BillingPlanId = "pro" | "scale";
export type BillingInterval = "month" | "quarter" | "half_year" | "year";

export type PublicBillingPlan = {
  id: BillingPlanId;
  name: string;
  currency: SupportedCurrency;
  priceMonthly: string;
  priceQuarterly: string;
  priceHalfYearly: string;
  /** Price of a year, billed up front. */
  priceAnnual: string;
  /** Minutes of source video allowed each month. */
  minuteLimit: number;
  /** Output height label, e.g. "1080p". */
  resolution: string;
  scheduling: boolean;
  youtubeMaxMinutes: number;
  description: string;
  highlights: string[];
  cta: string;
  highlighted: boolean;
};

export const ALL_BILLING_INTERVALS: BillingInterval[] = [
  "month",
  "quarter",
  "half_year",
  "year",
];

export const PAID_PLAN_IDS: BillingPlanId[] = ["pro", "scale"];

export function billingPlanMessageKey(plan: string | null | undefined): "free" | "pro" | "scale" | "selfHost" {
  if (plan === "pro" || plan === "scale") return plan;
  if (plan === "self_host") return "selfHost";
  return "free";
}

export function formatBillingPlanName(plan: string | null | undefined): string {
  if (plan === "pro") {
    return "Pro";
  }
  if (plan === "scale") {
    return "Creator";
  }
  if (plan === "self_host") {
    return "Self-Hosted";
  }
  return "Free";
}

export function isPaidBillingPlan(plan: string | null | undefined): plan is BillingPlanId {
  return plan === "pro" || plan === "scale";
}

export type SocialPublishingStage = "off" | "soon" | "live";

/**
 * How plan pages present scheduled posting (a Creator feature):
 * hidden ("off"), marked "Coming soon" (default, while platform reviews are
 * pending), or listed as a live feature ("live"). Set NEXT_PUBLIC_SOCIAL_PUBLISHING.
 */
export function socialPublishingStage(): SocialPublishingStage {
  const value = process.env.NEXT_PUBLIC_SOCIAL_PUBLISHING?.trim().toLowerCase();
  if (value === "off" || value === "0") return "off";
  if (value === "live" || value === "1") return "live";
  return "soon";
}

export function isBillingInterval(value: unknown): value is BillingInterval {
  return value === "month" || value === "quarter" || value === "half_year" || value === "year";
}

export function intervalMonths(interval: BillingInterval): number {
  switch (interval) {
    case "quarter":
      return 3;
    case "half_year":
      return 6;
    case "year":
      return 12;
    case "month":
    default:
      return 1;
  }
}

export function getPublicBillingPlans(currency: SupportedCurrency = "INR"): PublicBillingPlan[] {
  const isINR = currency === "INR";
  const proPriceMonthly = isINR
    ? (process.env.NEXT_PUBLIC_PRO_PRICE_MONTHLY || "1400")
    : (process.env.NEXT_PUBLIC_PRO_USD_PRICE_MONTHLY || "29");
  const proPriceQuarterly = isINR
    ? (process.env.NEXT_PUBLIC_PRO_PRICE_QUARTERLY || "3999")
    : (process.env.NEXT_PUBLIC_PRO_USD_PRICE_QUARTERLY || "79");
  const proPriceHalfYearly = isINR
    ? (process.env.NEXT_PUBLIC_PRO_PRICE_HALF_YEARLY || "7499")
    : (process.env.NEXT_PUBLIC_PRO_USD_PRICE_HALF_YEARLY || "149");
  const proPriceAnnual = isINR
    ? (process.env.NEXT_PUBLIC_PRO_PRICE_ANNUAL || "13999")
    : (process.env.NEXT_PUBLIC_PRO_USD_PRICE_ANNUAL || "249");

  const scalePriceMonthly = isINR
    ? (process.env.NEXT_PUBLIC_SCALE_PRICE_MONTHLY || "3499")
    : (process.env.NEXT_PUBLIC_SCALE_USD_PRICE_MONTHLY || "69");
  const scalePriceQuarterly = isINR
    ? (process.env.NEXT_PUBLIC_SCALE_PRICE_QUARTERLY || "8999")
    : (process.env.NEXT_PUBLIC_SCALE_USD_PRICE_QUARTERLY || "179");
  const scalePriceHalfYearly = isINR
    ? (process.env.NEXT_PUBLIC_SCALE_PRICE_HALF_YEARLY || "16999")
    : (process.env.NEXT_PUBLIC_SCALE_USD_PRICE_HALF_YEARLY || "329");
  const scalePriceAnnual = isINR
    ? (process.env.NEXT_PUBLIC_SCALE_PRICE_ANNUAL || "29999")
    : (process.env.NEXT_PUBLIC_SCALE_USD_PRICE_ANNUAL || "549");

  // Mirrors the backend's PRO_/SCALE_PLAN_MINUTE_LIMIT defaults.
  const proMinutes = parseInt(process.env.NEXT_PUBLIC_PRO_PLAN_MINUTE_LIMIT || "600", 10);
  const scaleMinutes = parseInt(process.env.NEXT_PUBLIC_SCALE_PLAN_MINUTE_LIMIT || "1500", 10);
  // Mirrors the backend's PRO_/SCALE_YOUTUBE_MAX_VIDEO_DURATION defaults.
  const proYoutubeMinutes = parseInt(process.env.NEXT_PUBLIC_PRO_YOUTUBE_MAX_MINUTES || "90", 10);
  const scaleYoutubeMinutes = parseInt(process.env.NEXT_PUBLIC_SCALE_YOUTUBE_MAX_MINUTES || "180", 10);

  return [
    {
      id: "pro",
      name: "Pro",
      currency,
      priceMonthly: proPriceMonthly,
      priceQuarterly: proPriceQuarterly,
      priceHalfYearly: proPriceHalfYearly,
      priceAnnual: proPriceAnnual,
      minuteLimit: proMinutes,
      resolution: "720p",
      scheduling: false,
      youtubeMaxMinutes: proYoutubeMinutes,
      description: "For creators who clip consistently each month.",
      highlights: [
        "🎁 7-Day Free Trial (₹0 today, then autopay)",
        `${formatMinutes(proMinutes)} of video every month`,
        "720p clips",
        `YouTube videos up to ${formatMinutes(proYoutubeMinutes)}`,
        "Custom fonts, B-roll and caption templates",
      ],
      cta: "Start 7-Day Free Trial",
      highlighted: true,
    },
    {
      id: "scale",
      name: "Creator",
      currency,
      priceMonthly: scalePriceMonthly,
      priceQuarterly: scalePriceQuarterly,
      priceHalfYearly: scalePriceHalfYearly,
      priceAnnual: scalePriceAnnual,
      minuteLimit: scaleMinutes,
      resolution: "1080p",
      scheduling: true,
      youtubeMaxMinutes: scaleYoutubeMinutes,
      description: "For creators publishing every day.",
      highlights: [
        "🎁 7-Day Free Trial (₹0 today, then autopay)",
        `${formatMinutes(scaleMinutes)} of video every month`,
        "Full HD 1080p clips",
        `YouTube videos up to ${formatMinutes(scaleYoutubeMinutes)}`,
        "Priority processing",
      ],
      cta: "Start 7-Day Free Trial",
      highlighted: false,
    },
  ];
}

/**
 * Plans people can buy right now. NEXT_PUBLIC_BILLING_PLANS (e.g. "pro")
 * limits it to the ones set up with the payment provider; unset means all.
 */
export function getOfferedBillingPlans(currency: SupportedCurrency = "INR"): PublicBillingPlan[] {
  const plans = getPublicBillingPlans(currency);
  const allowed = (process.env.NEXT_PUBLIC_BILLING_PLANS ?? "")
    .split(",")
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);
  if (allowed.length === 0) return plans;
  const offered = plans.filter((plan) => allowed.includes(plan.id));
  return offered.length > 0 ? offered : plans;
}

/** The plan's price for one billing interval. */
export function planPrice(plan: PublicBillingPlan, interval: BillingInterval): string {
  switch (interval) {
    case "quarter":
      return plan.priceQuarterly;
    case "half_year":
      return plan.priceHalfYearly;
    case "year":
      return plan.priceAnnual;
    case "month":
    default:
      return plan.priceMonthly;
  }
}

/** What the period would cost without discount (monthly price * months). */
export function intervalFullPrice(plan: PublicBillingPlan, interval: BillingInterval): string {
  const months = intervalMonths(interval);
  const full = Number(plan.priceMonthly) * months;
  return Number.isInteger(full) ? String(full) : full.toFixed(2);
}

/** What twelve months would cost at the monthly price. */
export function annualFullPrice(plan: PublicBillingPlan): string {
  return intervalFullPrice(plan, "year");
}

/** What a multi-month plan works out to per month. */
export function intervalMonthlyEquivalent(plan: PublicBillingPlan, interval: BillingInterval): string {
  const months = intervalMonths(interval);
  const total = Number(planPrice(plan, interval));
  const monthly = total / months;
  return Number.isInteger(monthly) ? String(monthly) : Math.round(monthly).toString();
}

/** What an annual plan works out to per month. */
export function annualMonthlyEquivalent(plan: PublicBillingPlan): string {
  return intervalMonthlyEquivalent(plan, "year");
}

/** Percentage saved by choosing this interval over monthly. */
export function intervalDiscountPercent(plan: PublicBillingPlan, interval: BillingInterval): number {
  const months = intervalMonths(interval);
  if (months <= 1) return 0;
  const standardTotal = Number(plan.priceMonthly) * months;
  const actualTotal = Number(planPrice(plan, interval));
  if (standardTotal <= 0 || actualTotal >= standardTotal) return 0;
  return Math.round(((standardTotal - actualTotal) / standardTotal) * 100);
}

/** How many months of the monthly price an annual plan saves. */
export function annualMonthsFree(plan: PublicBillingPlan): number {
  const monthly = Number(plan.priceMonthly);
  if (!monthly) return 0;
  return Math.round(12 - Number(plan.priceAnnual) / monthly);
}

export function formatMinutes(minutes: number): string {
  if (minutes >= 60 && minutes % 60 === 0) {
    const hours = minutes / 60;
    return `${hours} ${hours === 1 ? "hour" : "hours"}`;
  }
  return `${minutes} minutes`;
}

/** The plan one step above `plan`, or null when there is nothing to upgrade to. */
export function getNextBillingPlan(plan: string | null | undefined): PublicBillingPlan | null {
  const plans = getOfferedBillingPlans();
  if (plan === "scale" || plan === "self_host") return null;
  if (plan === "pro") return plans.find((candidate) => candidate.id === "scale") ?? null;
  return plans.find((candidate) => candidate.id === "pro") ?? null;
}
