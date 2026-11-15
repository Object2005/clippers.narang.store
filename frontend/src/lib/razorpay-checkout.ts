"use client";

/** Options returned by /api/billing/checkout when billing runs on Razorpay. */
export type RazorpayCheckoutOptions = {
  key: string;
  subscription_id: string;
  name: string;
  description: string;
  prefill: { email: string; name?: string };
};

type RazorpaySuccess = {
  razorpay_payment_id: string;
  razorpay_subscription_id: string;
  razorpay_signature: string;
};

type RazorpayInstance = { open(): void; on(event: string, handler: (response: unknown) => void): void };
type RazorpayConstructor = new (options: Record<string, unknown>) => RazorpayInstance;

const CHECKOUT_SCRIPT = "https://checkout.razorpay.com/v1/checkout.js";
let scriptPromise: Promise<RazorpayConstructor> | null = null;

function loadRazorpay(): Promise<RazorpayConstructor> {
  const existing = (window as unknown as { Razorpay?: RazorpayConstructor }).Razorpay;
  if (existing) return Promise.resolve(existing);
  if (!scriptPromise) {
    scriptPromise = new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = CHECKOUT_SCRIPT;
      script.async = true;
      script.onload = () => {
        const loaded = (window as unknown as { Razorpay?: RazorpayConstructor }).Razorpay;
        if (loaded) resolve(loaded);
        else reject(new Error("Razorpay checkout did not load. Please try again."));
      };
      script.onerror = () => {
        scriptPromise = null;
        reject(new Error("Razorpay checkout could not load. Check your connection and try again."));
      };
      document.body.appendChild(script);
    });
  }
  return scriptPromise;
}

/**
 * Opens Razorpay Checkout for the subscription and resolves once the payment
 * is verified by the server. Rejects if the customer closes it or it fails.
 */
export async function openRazorpayCheckout(options: RazorpayCheckoutOptions): Promise<void> {
  const Razorpay = await loadRazorpay();
  await new Promise<void>((resolve, reject) => {
    const checkout = new Razorpay({
      key: options.key,
      subscription_id: options.subscription_id,
      name: options.name,
      description: options.description,
      prefill: options.prefill,
      theme: { color: "#111111" },
      handler: (response: RazorpaySuccess) => {
        fetch("/api/billing/razorpay/verify", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(response),
        })
          .then(async (verify) => {
            if (verify.ok) return resolve();
            const data: { error?: string } = await verify.json().catch(() => ({}));
            reject(new Error(data.error || "We couldn't confirm the payment. If you were charged, it will activate shortly."));
          })
          .catch(() => reject(new Error("We couldn't confirm the payment. If you were charged, it will activate shortly.")));
      },
      modal: {
        ondismiss: () => reject(new Error("Payment was cancelled.")),
      },
    });
    // A failed attempt keeps the modal open so the customer can retry; closing it rejects above.
    checkout.open();
  });
}
