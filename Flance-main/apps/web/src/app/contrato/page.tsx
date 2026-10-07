"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import type { SubscriptionContract } from "@flance/types";
import { useI18n } from "../../i18n/useI18n";
import { getAcceptedContract, getSubscriptionContract } from "../../services/payments";

function ContractInner() {
  const { t } = useI18n();
  const showAccepted = useSearchParams().get("view") === "accepted";
  const [contract, setContract] = useState<SubscriptionContract | null>(null);
  const [acceptedAt, setAcceptedAt] = useState<string | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        if (showAccepted) {
          // Texto EXATO que o usuário aceitou (pode ser diferente do vigente hoje)
          const accepted = await getAcceptedContract();
          setContract(accepted.contract);
          setAcceptedAt(accepted.acceptedAt);
        } else {
          setContract(await getSubscriptionContract());
        }
      } catch {
        setError(true);
      }
    })();
  }, [showAccepted]);

  return (
    <main className="page-shell">
      <section className="section-shell">
        <article className="mx-auto w-full max-w-3xl">
          {error ? <div className="rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700">{t("contrato.loadError")}</div> : null}
          {!contract && !error ? (
            <div className="loader-wrap">
              <div className="loader" />
            </div>
          ) : null}
          {contract ? (
            <>
              <header className="mb-6">
                <h1 className="heading-lg">{contract.title}</h1>
                <p className="mt-2 text-sm text-slate-400">
                  {t("contrato.version", { version: contract.version })}
                  {acceptedAt ? ` · ${t("contrato.accepted", { date: new Date(acceptedAt).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" }) })}` : ""}
                </p>
                <button type="button" className="btn-outline mt-4 print:hidden" onClick={() => window.print()}>
                  {t("contrato.print")}
                </button>
              </header>
              <div className="card text-sm leading-relaxed text-slate-300">
                {contract.sections.map((section) => (
                  <section key={section.id} className="mb-5">
                    <h2 className="text-base font-semibold text-white">{section.title}</h2>
                    {section.paragraphs.map((paragraph, index) => (
                      <p key={index} className="mt-2">
                        {paragraph}
                      </p>
                    ))}
                  </section>
                ))}
                <p className="mt-6 border-t border-slate-700 pt-3 text-xs text-slate-500">
                  Hash SHA-256: <span className="break-all font-mono">{contract.hash}</span>
                </p>
              </div>
            </>
          ) : null}
        </article>
      </section>
    </main>
  );
}

export default function ContractPage() {
  return (
    <Suspense fallback={null}>
      <ContractInner />
    </Suspense>
  );
}
