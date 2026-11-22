"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { requestPasswordReset } from "../../lib/auth-client";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { ArrowRight, KeyRound, Mail } from "lucide-react";

export function ForgotPassword() {
  const t = useTranslations("auth");
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [resetUrl, setResetUrl] = useState<string | null>(null);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    const response = await requestPasswordReset({
      email,
      redirectTo: "/reset-password",
    });

    setLoading(false);
    if (response.error) {
      setError(response.error.message || t("forgot.failed"));
      return;
    }

    setSent(true);

    // Fetch direct reset link for instant access if email delivery is delayed
    try {
      const res = await fetch(`/api/auth/reset-link?email=${encodeURIComponent(email)}`);
      if (res.ok) {
        const data = await res.json();
        if (data?.url) {
          setResetUrl(data.url);
        }
      }
    } catch {
      // Direct link lookup is a secondary convenience
    }
  };

  return (
    <div className="w-full">
      <h1 className="font-display text-3xl font-bold tracking-tight">{t("forgot.title")}</h1>
      <p className="mt-2 text-sm text-muted-foreground">{t("forgot.subtitle")}</p>
      <div className="mt-8">
        {sent ? (
          <div className="space-y-4">
            <div className="flex items-start gap-3 rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-4 text-sm text-emerald-600 dark:text-emerald-400">
              <Mail className="size-5 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold">Reset Link Dispatched</p>
                <p className="mt-1 text-xs opacity-90">
                  {t("forgot.sent", { email })}
                </p>
              </div>
            </div>

            {resetUrl && (
              <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 text-sm">
                <div className="flex items-center gap-2 font-semibold text-foreground">
                  <KeyRound className="size-4 text-primary" />
                  <span>Instant Reset Access</span>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  Agar aapke email inbox ya spam folder me mail aane me deri ho, toh aap yahan se turant password reset kar sakte hain:
                </p>
                <Link
                  href={resetUrl}
                  className="mt-3 inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground shadow hover:bg-primary/90 transition-colors"
                >
                  <span>Reset Password Now</span>
                  <ArrowRight className="size-3.5" />
                </Link>
              </div>
            )}

            <div className="pt-2 text-center">
              <Link href="/sign-in" className="text-sm font-medium text-muted-foreground hover:text-foreground underline-offset-4 hover:underline">
                Remembered it? Sign in
              </Link>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              className="h-11"
              type="email"
              placeholder={t("forgot.email")}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              disabled={loading}
            />
            <Button type="submit" className="h-11 w-full" disabled={loading}>
              {loading ? t("forgot.submitting") : t("forgot.submit")}
            </Button>
          </form>
        )}
        {error && <p className="mt-4 text-sm text-red-600">{error}</p>}
      </div>
    </div>
  );
}
