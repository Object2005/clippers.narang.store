"use client";

import { useState } from "react";
import Link from "next/link";
import { RazorpayCheckoutButton } from "@/components/razorpay/razorpay-checkout-button";
import { Check, Sparkles, ArrowLeft, ShieldCheck, Zap } from "lucide-react";

export default function CheckoutPage() {
  const [selectedPlan, setSelectedPlan] = useState<"pro" | "scale">("pro");
  const [lastPayment, setLastPayment] = useState<any>(null);

  const amount =
    selectedPlan === "test" ? 100 : selectedPlan === "pro" ? 140000 : 349900; // in paise
  const priceDisplay =
    selectedPlan === "test" ? "₹1.00" : selectedPlan === "pro" ? "₹1,400" : "₹3,499";

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col items-center justify-center p-4 sm:p-8">
      <div className="w-full max-w-xl mx-auto space-y-6">
        {/* Navigation link */}
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="size-4" />
          <span>Back to Home</span>
        </Link>

        {/* Header */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center gap-1.5 rounded-full border border-primary/25 bg-primary/10 px-4 py-1 text-xs font-semibold text-primary">
            <Sparkles className="size-3.5" />
            <span>Razorpay Live Checkout</span>
          </div>
          <h1 className="text-3xl font-bold tracking-tight">Complete Your Subscription</h1>
          <p className="text-sm text-muted-foreground">
            Test and complete payments securely with UPI (Google Pay, PhonePe, Paytm), Snapmint EMI, Cards and NetBanking.
          </p>
        </div>

        {/* Plan Selector */}
        <div className="grid grid-cols-3 gap-2.5">
          <button
            type="button"
            onClick={() => setSelectedPlan("test")}
            className={`rounded-2xl border p-3.5 text-left transition-all ${
              selectedPlan === "test"
                ? "border-primary bg-primary/10 shadow-sm ring-1 ring-primary/40"
                : "border-border/60 hover:border-border"
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="font-semibold text-xs">Live Test</span>
              <span className="text-xs font-bold text-emerald-500">₹1</span>
            </div>
            <p className="mt-1 text-[11px] text-muted-foreground">Quick ₹1 Live UPI test</p>
          </button>

          <button
            type="button"
            onClick={() => setSelectedPlan("pro")}
            className={`rounded-2xl border p-3.5 text-left transition-all ${
              selectedPlan === "pro"
                ? "border-primary bg-primary/10 shadow-sm ring-1 ring-primary/40"
                : "border-border/60 hover:border-border"
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="font-semibold text-xs">Pro Plan</span>
              <span className="text-xs font-bold text-primary">₹1,400</span>
            </div>
            <p className="mt-1 text-[11px] text-muted-foreground">600 mins video, 1080p</p>
          </button>

          <button
            type="button"
            onClick={() => setSelectedPlan("scale")}
            className={`rounded-2xl border p-3.5 text-left transition-all ${
              selectedPlan === "scale"
                ? "border-primary bg-primary/10 shadow-sm ring-1 ring-primary/40"
                : "border-border/60 hover:border-border"
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="font-semibold text-xs">Creator</span>
              <span className="text-xs font-bold text-primary">₹3,499</span>
            </div>
            <p className="mt-1 text-[11px] text-muted-foreground">1500 mins, Autopilot</p>
          </button>
        </div>

        {/* Checkout Card */}
        <div className="rounded-3xl border bg-card p-6 shadow-xl space-y-6">
          <div className="border-b pb-4">
            <div className="flex justify-between items-baseline">
              <span className="text-base font-semibold">Total Amount</span>
              <span className="text-3xl font-extrabold tracking-tight text-primary">
                {priceDisplay}
              </span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Billed monthly via Razorpay • 7-Day Free Trial applies
            </p>
          </div>

          <ul className="space-y-2 text-xs text-muted-foreground">
            <li className="flex items-center gap-2">
              <Check className="size-3.5 text-emerald-500" />
              <span>Instant AI processing & 1-click virality extraction</span>
            </li>
            <li className="flex items-center gap-2">
              <Check className="size-3.5 text-emerald-500" />
              <span>Full HD 1080p resolution & animated karaoke captions</span>
            </li>
            <li className="flex items-center gap-2">
              <Check className="size-3.5 text-emerald-500" />
              <span>Supported: Google Pay, PhonePe, Paytm, Snapmint 0% EMI, Cards</span>
            </li>
          </ul>

          {/* Razorpay Standard Checkout Button Component */}
          <RazorpayCheckoutButton
            amount={amount}
            currency="INR"
            name="Clippers"
            description={`Clippers ${selectedPlan === "scale" ? "Creator" : "Pro"} Subscription`}
            planId={selectedPlan}
            buttonText={`Pay ${priceDisplay} with Razorpay`}
            onSuccess={(details) => setLastPayment(details)}
          />

          {/* Success details box */}
          {lastPayment && (
            <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-xs space-y-1">
              <div className="font-bold text-emerald-600 dark:text-emerald-400">
                Payment Completed & Verified!
              </div>
              <div className="font-mono text-[11px] text-muted-foreground">
                Payment ID: {lastPayment.razorpay_payment_id}
              </div>
              <div className="font-mono text-[11px] text-muted-foreground">
                Order ID: {lastPayment.razorpay_order_id}
              </div>
              <div className="pt-2">
                <Link
                  href="/settings"
                  className="inline-flex items-center gap-1 font-semibold text-primary underline underline-offset-2"
                >
                  View Subscription in Settings &rarr;
                </Link>
              </div>
            </div>
          )}

          {/* Security note */}
          <div className="flex items-center justify-center gap-2 text-[11px] text-muted-foreground pt-2">
            <ShieldCheck className="size-3.5 text-emerald-500" />
            <span>256-Bit Encrypted Payment • Powered by Razorpay</span>
          </div>
        </div>
      </div>
    </div>
  );
}
