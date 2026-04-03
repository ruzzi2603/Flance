"use client";

import { useState } from "react";
import { requestPasswordReset } from "../../../services/auth";

export default function ResetPage() {
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [resetUrl, setResetUrl] = useState<string | undefined>(undefined);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSuccess(false);
    setResetUrl(undefined);

    const formData = new FormData(event.currentTarget);
    const email = String(formData.get("email") || "").trim();
    if (!email) {
      setError("Informe seu email.");
      return;
    }

    setIsSending(true);
    try {
      const result = await requestPasswordReset(email);
      setSuccess(result.sent);
      setResetUrl(result.resetUrl);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Nao foi possivel enviar o link.";
      setError(message);
    } finally {
      setIsSending(false);
    }
  }

  return (
    <main className="page-shell">
      <section className="section-shell-sm">
        <div className="card-lg">
          <h1 className="heading-xl">Recuperar senha</h1>
          <p className="mt-2 text-muted">Vamos enviar um link de redefinicao para seu email.</p>

          <form className="mt-8 grid gap-5" onSubmit={handleSubmit}>
            <label className="form-label">
              Email
              <input className="input" type="email" name="email" placeholder="voce@exemplo.com" />
            </label>

            {error ? <div className="rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div> : null}
            {success ? (
              <div className="rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
                Se o email existir, enviamos o codigo e o link de confirmacao.
              </div>
            ) : null}

            <button type="submit" className="btn-primary" disabled={isSending}>
              {isSending ? "Enviando..." : "Enviar link"}
            </button>
          </form>

          <div className="mt-6 text-sm text-muted">
            <a className="text-slate-900 underline" href="/login">
              Voltar para login
            </a>
          </div>
        </div>
      </section>
    </main>
  );
}
