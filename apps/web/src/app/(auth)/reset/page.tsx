"use client";

import { useState } from "react";
import { requestPasswordReset } from "../../../services/auth";
import { useI18n } from "../../../i18n/useI18n";

export default function ResetPage() {
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [resetUrl, setResetUrl] = useState<string | undefined>(undefined);
  const { t } = useI18n();

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSuccess(false);
    setResetUrl(undefined);

    const formData = new FormData(event.currentTarget);
    const email = String(formData.get("email") || "").trim();
    if (!email) {
      setError(t("reset.emailRequired"));
      return;
    }

    setIsSending(true);
    try {
      const result = await requestPasswordReset(email);
      setSuccess(result.sent);
      setResetUrl(result.resetUrl);
    } catch (err) {
      const message = err instanceof Error ? err.message : t("reset.sendError");
      setError(message);
    } finally {
      setIsSending(false);
    }
  }

  return (
    <main className="page-shell">
      <section className="section-shell-sm">
        <div className="card-lg">
          <h1 className="heading-xl">{t("reset.title")}</h1>
          <p className="mt-2 text-muted">{t("reset.subtitle")}</p>

          <form className="mt-8 grid gap-5" onSubmit={handleSubmit}>
            <label className="form-label">
              {t("reset.email")}
              <input className="input" type="email" name="email" placeholder={t("reset.emailPlaceholder")} />
            </label>

            {error ? <div className="rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div> : null}
            {success ? (
              <div className="rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
                {t("reset.success")}
              </div>
            ) : null}

            <button type="submit" className="btn-primary" disabled={isSending}>
              {isSending ? t("reset.sending") : t("reset.send")}
            </button>
          </form>

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
