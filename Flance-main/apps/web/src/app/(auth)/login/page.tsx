"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import axios from "axios";
import { loginSchema } from "../../../services/schemas";
import { login, resendRegistrationCode, verifyRegistrationEmail } from "../../../services/auth";
import { useAuthStore } from "../../../store/useAuthStore";
import { useAuth } from "../../../hooks/useAuth";
import { useI18n } from "../../../i18n/useI18n";

export default function LoginPage() {
  const router = useRouter();
  const { setUser } = useAuthStore();
  const { user, isLoading, isAuthenticated } = useAuth();
  const { t } = useI18n();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const submitInProgress = useRef(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [verificationEmail, setVerificationEmail] = useState<string | null>(null);
  const [verificationCode, setVerificationCode] = useState("");
  const [resendCountdown, setResendCountdown] = useState(0);
  const [isVerifying, setIsVerifying] = useState(false);
  const [isResending, setIsResending] = useState(false);

  useEffect(() => {
    if (resendCountdown <= 0) return;
    const timer = window.setTimeout(() => setResendCountdown((seconds) => Math.max(0, seconds - 1)), 1000);
    return () => window.clearTimeout(timer);
  }, [resendCountdown]);

  useEffect(() => {
    if (isLoading) return;
    if (isAuthenticated && user) {
      router.replace(user.role === "ADMIN" ? "/admin" : "/profile");
    }
  }, [isLoading, isAuthenticated, user, router]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitInProgress.current) return;
    setFormError(null);

    const formData = new FormData(event.currentTarget);
    const payload = {
      email: String(formData.get("email") || ""),
      password: String(formData.get("password") || ""),
    };

    const parsed = loginSchema.safeParse(payload);
    if (!parsed.success) {
      const errors: Record<string, string> = {};
      for (const issue of parsed.error.issues) {
        const key = issue.path[0];
        if (typeof key === "string") {
          errors[key] = issue.message;
        }
      }
      setFieldErrors(errors);
      return;
    }

    setFieldErrors({});
    submitInProgress.current = true;
    setIsSubmitting(true);

    try {
      const result = await login(parsed.data);
      setUser(result.user);
      router.push(result.user.role === "ADMIN" ? "/admin" : "/profile");
    } catch (error) {
      const responseData = axios.isAxiosError(error)
        ? error.response?.data as { message?: string; resendAfterSeconds?: number } | undefined
        : undefined;
      if (responseData?.message === "Email verification required") {
        setVerificationEmail(parsed.data.email);
        setResendCountdown(responseData.resendAfterSeconds ?? 60);
        setFormError(t("auth.login.verifySent"));
        setIsSubmitting(false);
        return;
      }
      setFormError(t("auth.login.error"));
    } finally {
      submitInProgress.current = false;
      setIsSubmitting(false);
    }
  }

  async function handleVerifyEmail(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!verificationEmail) return;
    setFormError(null);
    setIsVerifying(true);
    try {
      const result = await verifyRegistrationEmail({ email: verificationEmail, code: verificationCode.trim() });
      setUser(result.user);
      router.push(result.user.role === "ADMIN" ? "/admin" : "/profile");
    } catch {
      setFormError(t("auth.register.verifyError"));
    } finally {
      setIsVerifying(false);
    }
  }

  async function handleResendCode() {
    if (!verificationEmail || resendCountdown > 0) return;
    setFormError(null);
    setIsResending(true);
    try {
      const result = await resendRegistrationCode(verificationEmail);
      setResendCountdown(result.resendAfterSeconds);
      setFormError(t("auth.register.codeResent"));
    } catch {
      setFormError(t("auth.register.resendError"));
    } finally {
      setIsResending(false);
    }
  }

  return (
    <main className="page-shell">
      <section className="section-shell-md">
        <div className="card-lg">
          <h1 className="heading-xl">{verificationEmail ? t("auth.register.verifyTitle") : t("auth.login.title")}</h1>
          <p className="mt-2 text-muted">
            {verificationEmail ? t("auth.register.verifySubtitle", { email: verificationEmail }) : t("auth.login.subtitle")}
          </p>

          {verificationEmail ? (
            <form className="mt-8 grid gap-5" onSubmit={handleVerifyEmail}>
              <label className="form-label">
                {t("auth.register.verificationCode")}
                <input className="input" name="verificationCode" value={verificationCode}
                  onChange={(event) => setVerificationCode(event.target.value.replace(/\D/g, "").slice(0, 6))}
                  inputMode="numeric" autoComplete="one-time-code" placeholder="000000" required minLength={6} maxLength={6} />
              </label>
              {formError ? <div className="rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-800" role="status">{formError}</div> : null}
              <button type="submit" className="btn-primary" disabled={isVerifying || verificationCode.length !== 6}>
                {isVerifying ? t("auth.register.verifying") : t("auth.register.verifyButton")}
              </button>
              <button type="button" className="btn-outline" disabled={isResending || resendCountdown > 0} onClick={() => void handleResendCode()}>
                {isResending ? t("auth.register.resending") : resendCountdown > 0 ? t("auth.register.resendCountdown", { seconds: resendCountdown }) : t("auth.register.resendCode")}
              </button>
            </form>
          ) : (
          <form className="mt-8 grid gap-5" onSubmit={handleSubmit}>
            <label className="form-label">
              {t("auth.login.email")}
              <input
                className="input"
                type="email"
                name="email"
                placeholder={t("auth.login.emailPlaceholder")}
                autoComplete="email"
              />
              {fieldErrors.email ? <span className="text-xs text-rose-600">{fieldErrors.email}</span> : null}
            </label>
            <label className="form-label">
              {t("auth.login.password")}
              <input
                className="input"
                type="password"
                name="password"
                placeholder={t("auth.login.passwordPlaceholder")}
                autoComplete="current-password"
              />
              {fieldErrors.password ? <span className="text-xs text-rose-600">{fieldErrors.password}</span> : null}
            </label>

            {formError ? (
              <div className="rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700">{formError}</div>
            ) : null}

            <button
              type="submit"
              disabled={isSubmitting}
              className="btn-primary disabled:cursor-not-allowed disabled:opacity-70"
            >
              {isSubmitting ? t("auth.login.loading") : t("auth.login.button")}
            </button>
          </form>
          )}

          <div className="mt-6 flex flex-wrap items-center gap-3 text-sm text-muted">
            <a className="text-slate-900 underline" href="/register" id="Remember">
              {t("auth.login.create")}
            </a>
            <span>|</span>
            <a className="text-slate-900 underline" id="Remember" href="/reset">
              {t("auth.login.forgot")}
            </a>
          </div>
        </div>
      </section>
    </main>
  );
}
