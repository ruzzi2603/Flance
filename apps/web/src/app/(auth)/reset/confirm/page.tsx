"use client";

import { Suspense, useMemo, useState, type FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { resetPassword } from "../../../../services/auth";

function ChromeBlocker() {
  // Hide global chrome only on reset confirmation screens.
  return <style jsx global>{".nav-root,.app-footer{display:none!important;}"} </style>;
}

function ResetConfirmInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = useMemo(() => searchParams.get("token") || "", [searchParams]);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (!token) {
      setError("Token invalido.");
      return;
    }

    if (password.length < 8) {
      setError("A senha precisa ter no minimo 8 caracteres.");
      return;
    }

    if (password !== confirm) {
      setError("As senhas nao conferem.");
      return;
    }

    setIsSaving(true);
    try {
      await resetPassword(token, password);
      setSuccess(true);
      setTimeout(() => router.push("/login"), 1200);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Nao foi possivel redefinir a senha.";
      setError(message);
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <>
      <ChromeBlocker />
      <main className="page-shell">
        <section className="section-shell-sm">
          <div className="card-lg">
            <h1 className="heading-xl">Definir nova senha</h1>
            <p className="mt-2 text-muted">Escolha uma nova senha para sua conta.</p>

            <form className="mt-8 grid gap-5" onSubmit={handleSubmit}>
              <label className="form-label">
                Nova senha
                <input
                  className="input"
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="********"
                />
              </label>
              <label className="form-label">
                Confirmar senha
                <input
                  className="input"
                  type="password"
                  value={confirm}
                  onChange={(event) => setConfirm(event.target.value)}
                  placeholder="********"
                />
              </label>

              {error ? <div className="rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div> : null}
              {success ? (
                <div className="rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
                  Senha atualizada com sucesso. Redirecionando...
                </div>
              ) : null}

              <button type="submit" className="btn-primary" disabled={isSaving}>
                {isSaving ? "Salvando..." : "Salvar nova senha"}
              </button>
            </form>
          </div>
        </section>
      </main>
    </>
  );
}

export default function ResetConfirmPage() {
  return (
    <Suspense
      fallback={
        <>
          <ChromeBlocker />
          <main className="page-shell">
            <section className="section-shell-sm">
              <div className="card-lg">Carregando...</div>
            </section>
          </main>
        </>
      }
    >
      <ResetConfirmInner />
    </Suspense>
  );
}
