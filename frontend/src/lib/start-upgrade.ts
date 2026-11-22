"use client";

import type { BillingInterval, BillingPlanId } from "@/lib/billing-plans";
import { clearCreatorCode, getStoredCreatorCode } from "@/lib/creator-code";
import { track } from "@/lib/datafast";
import { EXISTING_SUBSCRIPTION_NEEDS_PAYMENT } from "@/lib/subscription-status";
import { openRazorpayCheckout, type RazorpayCheckoutOptions } from "@/lib/razorpay-checkout";
import { detectUserCurrency, type SupportedCurrency } from "@/lib/billing-provider";

async function requestCheckout(
  plan: BillingPlanId,
  interval: BillingInterval,
  code: string | null,
  currency: SupportedCurrency = detectUserCurrency(),
) {
  const response = await fetch("/api/billing/checkout", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(code ? { plan, interval, code, currency } : { plan, interval, currency }),
  });
  const data: { url?: string; error?: string; code?: string; razorpay?: RazorpayCheckoutOptions } =
    await response.json().catch(() => ({}));
  return { response, data };
}

/**
 * Sends the user to Razorpay (for INR) or Stripe (for USD) for `plan`, billed every `interval`.
 */
export async function startUpgrade(
  plan: BillingPlanId,
  source: string,
  interval: BillingInterval = "month",
  currency: SupportedCurrency = detectUserCurrency(),
): Promise<void> {
  const code = getStoredCreatorCode();
  let { response, data } = await requestCheckout(plan, interval, code, currency);
  if (data.code === EXISTING_SUBSCRIPTION_NEEDS_PAYMENT) {
    const portal = await fetch("/api/billing/portal", { method: "POST" });
    const portalData: { url?: string; error?: string } = await portal.json().catch(() => ({}));
    if (!portal.ok || !portalData.url) {
      throw new Error(portalData.error || data.error || "We couldn't open checkout. Please try again.");
    }
    window.location.href = portalData.url;
    return;
  }
  // Must match INVALID_CREATOR_CODE in server/affiliates.ts (server-only module).
  if (code && data.code === "invalid_creator_code") {
    clearCreatorCode();
    ({ response, data } = await requestCheckout(plan, interval, null));
  }
  if (response.ok && data.razorpay) {
    track("upgrade_started", { plan, interval, source });
    await openRazorpayCheckout(data.razorpay);
    window.location.href = "/settings?billing=success";
    return;
  }
  if (!response.ok || !data.url) {
    throw new Error(data.error || "We couldn't open checkout. Please try again.");
  }
  track("upgrade_started", { plan, interval, source, ...(code ? { creator_code: code } : {}) });
  window.location.href = data.url;
}
