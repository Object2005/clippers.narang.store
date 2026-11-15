/**
 * Which payment provider hosted billing uses, plus how prices are shown.
 * NEXT_PUBLIC_* values are baked in at build time, so these are safe on both
 * the server and the client.
 */

export type BillingProvider = "stripe" | "razorpay";

export function billingProvider(): BillingProvider {
  return process.env.NEXT_PUBLIC_BILLING_PROVIDER?.trim().toLowerCase() === "razorpay"
    ? "razorpay"
    : "stripe";
}

export function razorpayBillingEnabled(): boolean {
  return billingProvider() === "razorpay";
}

/** Symbol shown before prices, e.g. "$" or "₹". */
export function currencySymbol(): string {
  return process.env.NEXT_PUBLIC_CURRENCY_SYMBOL?.trim() || "$";
}

/** `price` with the currency symbol in front, e.g. "₹799". */
export function formatPrice(price: string | number): string {
  return `${currencySymbol()}${price}`;
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
