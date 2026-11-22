"use client";

import { useEffect, useState } from "react";
import { Loader2, Tag, CheckCircle2, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  captureCreatorCodeFromUrl,
  clearCreatorCode,
  getStoredCreatorCode,
  storeCreatorCode,
} from "@/lib/creator-code";
import { cn } from "@/lib/utils";

interface PromoDetails {
  code: string;
  discount?: number;
  description?: string;
  is100PercentFree?: boolean;
}

/** "Have a discount coupon or creator code?" for new subscribers; applied at checkout. */
export function CreatorCodeField({ className }: { className?: string }) {
  const [applied, setApplied] = useState<string | null>(null);
  const [promoInfo, setPromoInfo] = useState<PromoDetails | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [value, setValue] = useState("");
  const [isChecking, setIsChecking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchCodeDetails = async (code: string) => {
    try {
      const response = await fetch(`/api/affiliates/offer?code=${encodeURIComponent(code)}`);
      if (response.ok) {
        const data = (await response.json()) as PromoDetails;
        setPromoInfo(data);
        return data;
      }
    } catch {
      // ignore
    }
    return null;
  };

  useEffect(() => {
    void captureCreatorCodeFromUrl().then((code) => {
      if (code) {
        setApplied(code);
        void fetchCodeDetails(code);
      } else {
        const stored = getStoredCreatorCode();
        if (stored) {
          setApplied(stored);
          void fetchCodeDetails(stored);
        }
      }
    });
  }, []);

  const apply = async (event: React.FormEvent) => {
    event.preventDefault();
    const trimmed = value.trim().toUpperCase();
    if (!trimmed) return;
    setIsChecking(true);
    setError(null);

    const details = await fetchCodeDetails(trimmed);
    setIsChecking(false);

    if (!details?.code) {
      setError("Invalid discount coupon or creator code");
      return;
    }

    storeCreatorCode(details.code);
    setApplied(details.code);
    setPromoInfo(details);
    setIsOpen(false);
    setValue("");
  };

  const remove = () => {
    clearCreatorCode();
    setApplied(null);
    setPromoInfo(null);
  };

  if (applied) {
    return (
      <div className={cn("flex items-center gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-1.5 text-xs text-emerald-400", className)}>
        <CheckCircle2 className="size-4 shrink-0 text-emerald-400" />
        <span className="font-medium">
          Coupon <span className="font-mono font-bold text-foreground">{applied}</span> applied
          {promoInfo?.discount ? ` (${promoInfo.discount}% OFF)` : ""}
        </span>
        <button
          type="button"
          onClick={remove}
          className="ml-auto flex items-center gap-1 text-muted-foreground hover:text-foreground"
          title="Remove coupon"
        >
          <X className="size-3.5" />
          <span>Remove</span>
        </button>
      </div>
    );
  }

  if (!isOpen) {
    return (
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className={cn(
          "flex items-center gap-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground hover:underline underline-offset-2",
          className
        )}
      >
        <Tag className="size-3.5" />
        <span>Have a coupon or discount code?</span>
      </button>
    );
  }

  return (
    <form onSubmit={apply} className={cn("space-y-1.5", className)}>
      <div className="flex gap-2">
        <Input
          value={value}
          onChange={(event) => setValue(event.target.value)}
          placeholder="ENTER COUPON CODE"
          aria-label="Coupon code"
          maxLength={20}
          autoFocus
          className="h-8 font-mono text-xs uppercase"
        />
        <Button type="submit" size="sm" variant="outline" disabled={!value.trim() || isChecking} className="h-8 text-xs">
          {isChecking ? <Loader2 className="size-3 animate-spin" /> : "Apply"}
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={() => setIsOpen(false)} className="h-8 text-xs">
          Cancel
        </Button>
      </div>
      {error && <p className="text-xs text-red-500">{error}</p>}
    </form>
  );
}
