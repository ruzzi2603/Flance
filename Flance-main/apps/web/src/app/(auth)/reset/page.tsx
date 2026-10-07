"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { requestPasswordReset, resetPassword, verifyResetCodeByEmail } from "../../../services/auth";
import { useI18n } from "../../../i18n/useI18n";

type ResetStep = "email" | "code" | "password";

export default function ResetPage() {
  const router = useRouter();
  const { t } = useI18n();
  const [step, setStep] = useState<ResetStep>("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [resetToken, setResetToken] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [passwordChanged, setPasswordChanged] = useState(false);

  async function handleRequestCode(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      const result = await requestPasswordReset(email.trim());
      if (result.sent) setStep("code");
      else setError(t("reset.emailNotFound"));
    } catch (err) {
      setError(err instanceof Error ? err.message : t("reset.sendError"));
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleVerifyCode(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    if (!/^\d{6}$/.test(code)) {
      setError(t("reset.codeInvalid"));
      return;
    }

    setIsSubmitting(true);
    try {
      const token = await verifyResetCodeByEmail(email.trim(), code);
      setResetToken(token);
      setStep("password");
    } catch (err) {
      setError(err instanceof Error ? err.message : t("reset.codeInvalid"));
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleChangePassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    if (password.length < 8) {
      setError(t("reset.passwordMin"));
      return;
    }
    if (password !== confirmPassword) {
      setError(t("reset.passwordMismatch"));
      return;
    }

    setIsSubmitting(true);
    try {
      await resetPassword(resetToken, password);
      setPasswordChanged(true);
      setTimeout(() => router.push("/login"), 1500);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("reset.passwordError"));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="page-shell">
      <section className="section-shell-sm">
        <div className="card-lg">
          <h1 className="heading-xl">{t("reset.title")}</h1>
          <p className="mt-2 text-muted">
            {step === "email" ? t("reset.subtitle") : step === "code" ? t("reset.codeSent", { email }) : t("reset.newPasswordSubtitle")}
          </p>

          {step === "email" ? (
            <form className="mt-8 grid gap-5" onSubmit={handleRequestCode}>
              <label className="form-label">
                {t("reset.email")}
                <input
                  className="input"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder={t("reset.emailPlaceholder")}
                />
              </label>
              {error ? <div className="rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div> : null}
              <button type="submit" className="btn-primary" disabled={isSubmitting}>
                {isSubmitting ? t("reset.sending") : t("reset.send")}
              </button>
            </form>
          ) : null}

          {step === "code" ? (
            <form className="mt-8 grid gap-5" onSubmit={handleVerifyCode}>
              <label className="form-label">
                {t("reset.code")}
                <input
                  className="input"
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  pattern="[0-9]{6}"
                  maxLength={6}
                  required
                  value={code}
                  onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 6))}
                  placeholder={t("reset.codePlaceholder")}
                />
              </label>
              {error ? <div className="rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div> : null}
              <button type="submit" className="btn-primary" disabled={isSubmitting}>
                {isSubmitting ? t("reset.verifying") : t("reset.verifyCode")}
              </button>
              <button type="button" className="btn-outline" onClick={() => { setError(null); setStep("email"); }}>
                {t("reset.changeEmail")}
              </button>
            </form>
          ) : null}

          {step === "password" ? (
            <form className="mt-8 grid gap-5" onSubmit={handleChangePassword}>
              <label className="form-label">
                {t("reset.newPassword")}
                <input
                  className="input"
                  type="password"
                  autoComplete="new-password"
                  minLength={8}
                  required
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="********"
                />
              </label>
              <label className="form-label">
                {t("reset.confirmPassword")}
                <input
                  className="input"
                  type="password"
                  autoComplete="new-password"
                  minLength={8}
                  required
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  placeholder="********"
                />
              </label>
              {error ? <div className="rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div> : null}
              {passwordChanged ? (
                <div className="rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{t("reset.passwordSuccess")}</div>
              ) : null}
              <button type="submit" className="btn-primary" disabled={isSubmitting || passwordChanged}>
                {isSubmitting ? t("reset.saving") : t("reset.savePassword")}
              </button>
            </form>
          ) : null}

          <div className="mt-6 text-sm text-muted">
            <a className="text-slate-900 underline" href="/login">
              {t("reset.backLogin")}
            </a>
          </div>
        </div>
      </section>
    </main>
  );
}
