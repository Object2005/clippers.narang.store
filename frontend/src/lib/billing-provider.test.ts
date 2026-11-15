import { applyCurrencySymbol, formatPrice } from "./billing-provider";

describe("billing-provider", () => {
  const env = process.env;
  afterEach(() => {
    process.env = env;
  });

  it("swaps the dollar sign before price placeholders only", () => {
    const messages = { plan: { a: "${price}/mo", b: "about ${monthly}/mo", c: "Save $5 today", d: ["${proPrice} vs ${scalePrice}"] } };
    expect(applyCurrencySymbol(messages, "₹")).toEqual({
      plan: { a: "₹{price}/mo", b: "about ₹{monthly}/mo", c: "Save $5 today", d: ["₹{proPrice} vs ₹{scalePrice}"] },
    });
    expect(applyCurrencySymbol(messages, "$")).toBe(messages);
  });

  it("formats prices with the configured symbol", () => {
    process.env = { ...env, NEXT_PUBLIC_CURRENCY_SYMBOL: "₹" };
    expect(formatPrice("799")).toBe("₹799");
    process.env = { ...env, NEXT_PUBLIC_CURRENCY_SYMBOL: "" };
    expect(formatPrice("9.99")).toBe("$9.99");
  });
});
