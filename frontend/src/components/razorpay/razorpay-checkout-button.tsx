"use client";

import { useState, useEffect } from "react";
import { Loader2, ShieldCheck, CheckCircle2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

declare global {
  interface Window {
    Razorpay?: any;
  }
}

interface RazorpayCheckoutButtonProps {
  amount?: number; // in paise (e.g. 140000 = ₹1,400)
  currency?: string;
  name?: string;
  description?: string;
  planId?: string;
  prefill?: {
    name?: string;
    email?: string;
    contact?: string;
  };
  buttonText?: string;
  className?: string;
  onSuccess?: (paymentDetails: {
    razorpay_payment_id: string;
    razorpay_order_id: string;
    razorpay_signature: string;
  }) => void;
  onFailure?: (error: unknown) => void;
}

export function RazorpayCheckoutButton({
  amount = 140000, // ₹1,400 default in paise
  currency = "INR",
  name = "Clippers",
  description = "Clippers Pro Membership - ₹1,400/mo",
  planId = "pro",
  prefill,
  buttonText = "Pay with Razorpay",
  className = "",
  onSuccess,
  onFailure,
}: RazorpayCheckoutButtonProps) {
  const [loading, setLoading] = useState(false);
  const [scriptLoaded, setScriptLoaded] = useState(false);
  const [paymentStatus, setPaymentStatus] = useState<"idle" | "success" | "failed">("idle");
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  // Load Razorpay Standard Web Checkout script: https://checkout.razorpay.com/v1/checkout.js
  useEffect(() => {
    if (typeof window === "undefined") return;

    if (window.Razorpay) {
      setScriptLoaded(true);
      return;
    }

    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.async = true;
    script.onload = () => setScriptLoaded(true);
    script.onerror = () => {
      console.error("Failed to load Razorpay checkout script");
      toast.error("Could not load Razorpay SDK. Please check your internet connection.");
    };

    document.body.appendChild(script);

    return () => {
      // Keep script cached in document
    };
  }, []);

  const handlePayment = async () => {
    if (!window.Razorpay && !scriptLoaded) {
      toast.error("Razorpay SDK is still loading. Please wait a moment.");
      return;
    }

    setLoading(true);
    setPaymentStatus("idle");
    setStatusMessage(null);

    try {
      // STEP 1: Call Backend to Create Order
      const res = await fetch("/api/create-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount,
          currency,
          receipt: `rcpt_${Date.now()}`,
          notes: {
            plan: planId,
            appName: "Clippers",
          },
        }),
      });

      const orderData = await res.json();

      if (!res.ok || !orderData?.order_id) {
        throw new Error(orderData?.error || "Failed to create Razorpay order");
      }

      const keyId =
        process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID ||
        orderData.key_id ||
        "rzp_live_U2MSXyzMywqLHy";

      // STEP 2: Configure & Open Razorpay Checkout Modal
      const options = {
        key: keyId,
        amount: orderData.amount,
        currency: orderData.currency,
        name,
        description,
        order_id: orderData.order_id,
        prefill: {
          name: prefill?.name || "",
          email: prefill?.email || "",
          contact: prefill?.contact || "",
        },
        theme: {
          color: "#4f46e5", // Indigo / primary theme
        },
        handler: async function (response: {
          razorpay_payment_id: string;
          razorpay_order_id: string;
          razorpay_signature: string;
        }) {
          // STEP 3: Call Backend to Verify Payment Signature
          try {
            toast.info("Verifying payment signature with server...");
            const verifyRes = await fetch("/api/verify-payment", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                razorpay_order_id: response.razorpay_order_id,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature: response.razorpay_signature,
                plan: planId,
              }),
            });

            const verifyData = await verifyRes.json();

            if (verifyRes.ok && verifyData.success) {
              setPaymentStatus("success");
              setStatusMessage(`Payment Verified! Payment ID: ${response.razorpay_payment_id}`);
              toast.success("Payment successful and verified!");
              onSuccess?.(response);
            } else {
              setPaymentStatus("failed");
              const err = verifyData.error || "Payment signature verification failed";
              setStatusMessage(err);
              toast.error(err);
              onFailure?.(new Error(err));
            }
          } catch (verifyErr) {
            console.error("Verification network error:", verifyErr);
            setPaymentStatus("failed");
            setStatusMessage("Could not contact server to verify payment.");
            toast.error("Verification error occurred.");
            onFailure?.(verifyErr);
          } finally {
            setLoading(false);
          }
        },
        modal: {
          ondismiss: function () {
            // Error Handling: Handle modal dismiss (user cancelled)
            setLoading(false);
            toast.info("Payment cancelled by user.");
            console.log("Razorpay checkout modal dismissed by user");
          },
        },
      };

      const razorpayInstance = new window.Razorpay(options);

      // Error Handling: Handle payment.failed event
      razorpayInstance.on("payment.failed", function (failResponse: any) {
        console.error("Payment failed event:", failResponse?.error);
        setLoading(false);
        setPaymentStatus("failed");
        const errMsg =
          failResponse?.error?.description || "Payment failed. Please try a different payment method.";
        setStatusMessage(errMsg);
        toast.error(errMsg);
        onFailure?.(failResponse);
      });

      razorpayInstance.open();
    } catch (err: any) {
      console.error("Razorpay checkout initiation error:", err);
      setLoading(false);
      setPaymentStatus("failed");
      const msg = err.message || "An unexpected error occurred starting payment";
      setStatusMessage(msg);
      toast.error(msg);
      onFailure?.(err);
    }
  };

  return (
    <div className="flex flex-col items-center gap-3 w-full">
      <Button
        onClick={handlePayment}
        disabled={loading}
        className={`w-full font-semibold flex items-center justify-center gap-2 ${className}`}
        size="lg"
      >
        {loading ? (
          <>
            <Loader2 className="size-4 animate-spin" />
            <span>Processing Order...</span>
          </>
        ) : (
          <>
            <ShieldCheck className="size-5" />
            <span>{buttonText}</span>
          </>
        )}
      </Button>

      {/* Real-time Status feedback */}
      {paymentStatus === "success" && (
        <div className="flex items-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-600 dark:text-emerald-400">
          <CheckCircle2 className="size-4 shrink-0" />
          <span>{statusMessage}</span>
        </div>
      )}

      {paymentStatus === "failed" && (
        <div className="flex items-center gap-2 rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-600 dark:text-rose-400">
          <AlertCircle className="size-4 shrink-0" />
          <span>{statusMessage}</span>
        </div>
      )}
    </div>
  );
}
