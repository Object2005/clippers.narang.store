/**
 * Which payment provider hosted billing uses, plus how prices are shown.
 * NEXT_PUBLIC_* values are baked in at build time, so these are safe on both
 * the server and the client.
 */

export type BillingProvider = "stripe" | "razorpay";
export type SupportedCurrency = "INR" | "USD";

export function detectUserCurrency(): SupportedCurrency {
  if (typeof window === "undefined") {
    return process.env.NEXT_PUBLIC_CURRENCY_SYMBOL === "₹" ? "INR" : "USD";
  }
  try {
    const saved = localStorage.getItem("gtaclipper_currency") as SupportedCurrency;
    if (saved === "INR" || saved === "USD") return saved;
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (tz && (tz === "Asia/Kolkata" || tz === "Asia/Calcutta")) {
      return "INR";
    }
    const langs = navigator.languages || [navigator.language];
    if (langs.some((l) => l.includes("-IN") || l.startsWith("hi"))) {
      return "INR";
    }
  } catch {
    // fallback
  }
  return "USD";
}

export function setUserCurrency(currency: SupportedCurrency): void {
  if (typeof window !== "undefined") {
    try {
      localStorage.setItem("gtaclipper_currency", currency);
      window.dispatchEvent(new Event("currency_changed"));
    } catch {}
  }
}

export function currencySymbolFor(currency: SupportedCurrency): string {
  return currency === "INR" ? "₹" : "$";
}

export function paymentProviderFor(currency: SupportedCurrency): BillingProvider {
  return currency === "INR" ? "razorpay" : "stripe";
}

export function billingProvider(): BillingProvider {
  return process.env.NEXT_PUBLIC_BILLING_PROVIDER?.trim().toLowerCase() === "razorpay"
    ? "razorpay"
    : "stripe";
}

export function razorpayBillingEnabled(): boolean {
  return billingProvider() === "razorpay";
}

/** Symbol shown before prices, e.g. "$" or "₹". */
export function currencySymbol(currency?: SupportedCurrency): string {
  if (currency) return currencySymbolFor(currency);
  return process.env.NEXT_PUBLIC_CURRENCY_SYMBOL?.trim() || "$";
}

/** `price` with the currency symbol in front, e.g. "₹799" or "$19". */
export function formatPrice(price: string | number, currency?: SupportedCurrency): string {
  return `${currencySymbol(currency)}${price}`;
}

/** Yearly plans are offered unless NEXT_PUBLIC_ANNUAL_BILLING=false. */
export function annualBillingEnabled(): boolean {
  return process.env.NEXT_PUBLIC_ANNUAL_BILLING?.trim().toLowerCase() !== "false";
}

const PRICE_PLACEHOLDER = /\$(?=\{(?:price|monthly|proPrice|scalePrice)\})/g;

/** Swap the "$" written before price placeholders in message files for the configured symbol. */
export function applyCurrencySymbol<T>(messages: T, symbol: string = currencySymbol()): T {
  if (symbol === "$") return messages;
  const visit = (value: unknown): unknown => {
    if (typeof value === "string") return value.replace(PRICE_PLACEHOLDER, symbol);
    if (Array.isArray(value)) return value.map(visit);
    if (value && typeof value === "object") {
      return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, visit(item)]));
    }
    return value;
  };
  return visit(messages) as T;
}
