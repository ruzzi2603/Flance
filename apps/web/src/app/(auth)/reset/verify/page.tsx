"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { getResetOptions, verifyResetCode } from "../../../../services/auth";

function ChromeBlocker() {
  // Hide global chrome only on reset verification screens.
  return <style jsx global>{".nav-root,.app-footer{display:none!important;}"} </style>;
}

function ResetVerifyInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = useMemo(() => searchParams.get("token") || "", [searchParams]);
  const [options, setOptions] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadOptions() {
      if (!token) return;
      setLoading(true);
      setError(null);
      try {
        const list = await getResetOptions(token);
        setOptions(list);
      } catch (err) {
        const message = err instanceof Error ? err.message : "Nao foi possivel carregar os codigos.";
        setError(message);
      } finally {
        setLoading(false);
      }
    }

    loadOptions();
  }, [token]);

  async function handleSelect(option: string) {
    setError(null);
    try {
      const resetToken = await verifyResetCode(token, option);
      router.push(`/reset/confirm?token=${encodeURIComponent(resetToken)}`);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Codigo incorreto.";
      setError(message);
    }
  }

  return (
    <>
      <ChromeBlocker />
      <main className="page-shell">
        <section className="section-shell-sm">
          <div className="card-lg">
            <h1 className="heading-xl">Confirmar codigo</h1>
            <p className="mt-2 text-muted">Selecione o numero correto que enviamos para o seu email.</p>

            {loading ? (
              <div className="mt-6 flex justify-center">
                <div className="loader"></div>
              </div>
            ) : null}
            {error ? (
              <div className="mt-6 rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>
            ) : null}

            {!loading && options.length > 0 ? (
              <div className="mt-6 grid gap-3 sm:grid-cols-3">
                {options.map((option) => (
                  <button key={option} className="btn-outline" type="button" onClick={() => handleSelect(option)}>
                    {option}
                  </button>
                ))}
              </div>
            ) : null}
          </div>
        </section>
      </main>
    </>
  );
}

export default function ResetVerifyPage() {
  return (
    <Suspense
      fallback={
        <>
          <ChromeBlocker />
          <main className="page-shell">
            <section className="section-shell-sm">
              <div className="card-lg">
                <div className="loader-wrap">
                  <div className="loader"></div>
                </div>
              </div>
            </section>
          </main>
        </>
      }
    >
      <ResetVerifyInner />
    </Suspense>
  );
}
