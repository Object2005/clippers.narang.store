"use client";

import { useState } from "react";
import { Check, Sparkles, ArrowRight, ShieldCheck, Zap } from "lucide-react";
import { toast } from "sonner";
import {
  type BillingInterval,
  type BillingPlanId,
  getOfferedBillingPlans,
  intervalDiscountPercent,
  intervalFullPrice,
  intervalMonthlyEquivalent,
  planPrice,
} from "@/lib/billing-plans";
import { BillingIntervalToggle, CurrencyToggle } from "@/components/billing/upgrade-prompt";
import { detectUserCurrency, formatPrice, type SupportedCurrency } from "@/lib/billing-provider";
import { startUpgrade } from "@/lib/start-upgrade";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface HomeMembershipBannerProps {
  currentPlan?: string | null;
  onUpgradeSuccess?: () => void;
}

export function HomeMembershipBanner({ currentPlan, onUpgradeSuccess }: HomeMembershipBannerProps) {
  const [billingInterval, setBillingInterval] = useState<BillingInterval>("month");
  const [currency, setCurrency] = useState<SupportedCurrency>(() => detectUserCurrency());
  const [loadingPlan, setLoadingPlan] = useState<BillingPlanId | null>(null);

  const plans = getOfferedBillingPlans(currency);

  const handleChoosePlan = async (planId: BillingPlanId) => {
    setLoadingPlan(planId);
    try {
      await startUpgrade(planId, "home_membership_card", billingInterval, currency);
      onUpgradeSuccess?.();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Checkout failed. Please try again.");
    } finally {
      setLoadingPlan(null);
    }
  };

  return (
    <section className="mt-14 w-full rounded-3xl border bg-gradient-to-b from-card via-card/90 to-background p-6 shadow-xl sm:p-8">
      {/* Centered Cohesive Header */}
      <div className="flex flex-col items-center text-center">
        <div className="inline-flex items-center justify-center gap-1.5 rounded-full border border-primary/25 bg-primary/10 px-4 py-1 text-xs font-semibold text-primary shadow-xs">
          <Sparkles className="size-3.5" />
          <span>Membership Plans & Special Offers</span>
        </div>

        <h2 className="mt-3 font-display text-2xl font-bold tracking-tight sm:text-3xl">
          Choose Your Clippers Plan
        </h2>

        <p className="mt-1.5 max-w-xl text-sm leading-relaxed text-muted-foreground">
          Get more video minutes, 1080p Full HD clips, custom caption templates, and priority processing.
        </p>

        {/* Duration & Currency Switches Row */}
        <div className="mt-6 flex flex-wrap items-center justify-center gap-2.5">
          <BillingIntervalToggle value={billingInterval} onChange={setBillingInterval} plan={plans[0]} />
          <CurrencyToggle value={currency} onChange={setCurrency} />
        </div>
      </div>

      {/* Payment Gateway Supported Methods Bar */}
      <div className="mt-6 flex flex-col items-center justify-between gap-3 rounded-2xl border bg-muted/40 px-4 py-3 sm:flex-row">
        <div className="flex items-center gap-2 text-xs font-medium text-foreground">
          <ShieldCheck className="size-4 shrink-0 text-emerald-500" />
          <span>Supported Payment Methods:</span>
        </div>

        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="rounded-md border bg-background px-2 py-0.5 font-semibold text-foreground shadow-xs">
            Google Pay
          </span>
          <span className="rounded-md border bg-background px-2 py-0.5 font-semibold text-foreground shadow-xs">
            PhonePe
          </span>
          <span className="rounded-md border bg-background px-2 py-0.5 font-semibold text-foreground shadow-xs">
            Paytm UPI
          </span>
          <span className="rounded-md border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 font-semibold text-amber-600 dark:text-amber-400 shadow-xs">
            Snapmint EMI
          </span>
          <span className="rounded-md border bg-background px-2 py-0.5 font-semibold text-foreground shadow-xs">
            Cards / RuPay
          </span>
          <span className="rounded-md border border-primary/30 bg-primary/10 px-2 py-0.5 font-semibold text-primary shadow-xs">
            UPI AutoPay
          </span>
        </div>
      </div>

      {/* Plans Grid */}
      <div className="mt-6 grid grid-cols-1 gap-5 md:grid-cols-2">
        {plans.map((plan) => {
          const discount = intervalDiscountPercent(plan, billingInterval);
          const rawPrice = planPrice(plan, billingInterval);
          const priceNumber = parseInt(rawPrice, 10) || 0;
          const discountedPrice = priceNumber;

          const intervalUnit =
            billingInterval === "year"
              ? "/yr"
              : billingInterval === "half_year"
                ? "/6mo"
                : billingInterval === "quarter"
                  ? "/3mo"
                  : "/mo";

          const isCurrent = currentPlan === plan.id;

          return (
            <div
              key={plan.id}
              className={cn(
                "relative flex flex-col justify-between rounded-2xl border p-6 transition-all hover:shadow-md",
                plan.highlighted ? "border-primary/50 bg-primary/[0.02] ring-1 ring-primary/40" : "bg-card",
              )}
            >
              {plan.highlighted && (
                <span className="absolute -top-3 right-6 rounded-full bg-primary px-3 py-0.5 text-[11px] font-bold text-primary-foreground shadow">
                  MOST POPULAR
                </span>
              )}

              <div>
                <div className="flex items-center justify-between">
                  <h3 className="font-display text-xl font-bold">{plan.name}</h3>
                  <span className="rounded-md border bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                    {plan.resolution}
                  </span>
                </div>

                <p className="mt-1 text-xs text-muted-foreground">{plan.description}</p>

                {/* Price Display */}
                <div className="mt-4 flex flex-wrap items-baseline gap-2">
                  {billingInterval !== "month" && discount > 0 && (
                    <span className="text-sm text-muted-foreground line-through">
                      {formatPrice(intervalFullPrice(plan, billingInterval), currency)}
                    </span>
                  )}
                  <span className="font-display text-3xl font-extrabold tracking-tight">
                    {formatPrice(discountedPrice, currency)}
                  </span>
                  <span className="text-xs text-muted-foreground">{intervalUnit}</span>
                  {billingInterval !== "month" && (
                    <span className="text-xs font-medium text-emerald-600 dark:text-emerald-400">
                      ({formatPrice(intervalMonthlyEquivalent(plan, billingInterval), currency)}/mo equivalent)
                    </span>
                  )}
                </div>

                {/* Features List */}
                <ul className="mt-5 space-y-2 border-t pt-4 text-xs">
                  {plan.highlights.map((h) => (
                    <li key={h} className="flex items-start gap-2 text-muted-foreground">
                      <Check className="mt-0.5 size-3.5 shrink-0 text-emerald-500" />
                      <span>{h}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Action Button */}
              <div className="mt-6 pt-2">
                <Button
                  onClick={() => handleChoosePlan(plan.id)}
                  disabled={Boolean(loadingPlan) || isCurrent}
                  variant={plan.highlighted ? "default" : "outline"}
                  className="w-full font-semibold"
                >
                  {loadingPlan === plan.id ? (
                    "Processing..."
                  ) : isCurrent ? (
                    "Current Plan"
                  ) : (
                    <>
                      <span>Choose {plan.name}</span>
                      <ArrowRight className="ml-1 size-4" />
                    </>
                  )}
                </Button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Trust Badges */}
      <div className="mt-6 flex flex-wrap items-center justify-center gap-4 text-center text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1">
          <ShieldCheck className="size-3.5 text-emerald-500" /> 100% Secure Payments
        </span>
        <span>•</span>
        <span className="inline-flex items-center gap-1">
          <Zap className="size-3.5 text-amber-500" /> Instant Activation
        </span>
        <span>•</span>
        <span>Cancel anytime from settings</span>
      </div>
    </section>
  );
}
