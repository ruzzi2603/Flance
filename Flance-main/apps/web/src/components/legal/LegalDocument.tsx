"use client";

import { useEffect, useState } from "react";
import type { SubscriptionContract } from "@flance/types";
import { getSubscriptionContract } from "../../services/payments";
import type { LegalSection } from "../../lib/legal/types";

interface Props {
  title: string;
  version: string;
  updatedAt: string;
  intro: string;
  /** Monta as seções com os dados da empresa/planos vindos da API (null enquanto carrega ou se falhar) */
  buildSections: (contract: SubscriptionContract | null) => LegalSection[];
  companyHeading: string;
}

export function LegalDocument({ title, version, updatedAt, intro, buildSections, companyHeading }: Props) {
  const [contract, setContract] = useState<SubscriptionContract | null>(null);

  useEffect(() => {
    // Dados da empresa vêm do mesmo lugar do contrato (fonte única). Se falhar, o texto continua legível.
    getSubscriptionContract()
      .then(setContract)
      .catch(() => setContract(null));
  }, []);

  const sections = buildSections(contract);
  const company = contract?.company;

  return (
    <main className="page-shell">
      <section className="section-shell">
        <article className="mx-auto w-full max-w-3xl">
          <header className="mb-6">
            <h1 className="heading-lg">{title}</h1>
            <p className="mt-2 text-sm text-slate-400">
              Última atualização: {updatedAt} · Versão {version}
            </p>
            <p className="mt-4 text-sm leading-relaxed text-slate-300">{intro}</p>
            <button type="button" className="btn-outline mt-4 print:hidden" onClick={() => window.print()}>
              Imprimir / salvar em PDF
            </button>
          </header>

          {company ? (
            <aside className="card mb-6 text-sm text-slate-300" aria-label={companyHeading}>
              <h2 className="text-base font-semibold text-white">{companyHeading}</h2>
              <p className="mt-2">{company.legalName}</p>
              <p>CNPJ: {company.cnpj}</p>
              <p>{company.address}</p>
              <p>Contato e Encarregado (DPO): {company.privacyEmail}</p>
            </aside>
          ) : null}

          <div className="card text-sm leading-relaxed text-slate-300">
            <nav aria-label="Sumário" className="mb-6 print:hidden">
              <ul className="grid gap-1 text-xs sm:grid-cols-2">
                {sections.map((section) => (
                  <li key={section.id}>
                    <a className="text-sky-400 underline" href={`#${section.id}`}>
                      {section.title}
                    </a>
                  </li>
                ))}
              </ul>
            </nav>

            {sections.map((section) => (
              <section key={section.id} id={section.id} className="mb-6 scroll-mt-20">
                <h2 className="text-base font-semibold text-white">{section.title}</h2>
                {section.paragraphs?.map((text, index) => (
                  <p key={index} className="mt-2">
                    {text}
                  </p>
                ))}
                {section.bullets ? (
                  <ul className="mt-2 list-disc space-y-1 pl-5">
                    {section.bullets.map((text, index) => (
                      <li key={index}>{text}</li>
                    ))}
                  </ul>
                ) : null}
                {section.table ? (
                  <div className="mt-3 overflow-x-auto">
                    <table className="w-full min-w-[32rem] border-collapse text-left text-xs">
                      <thead>
                        <tr>
                          {section.table.head.map((heading) => (
                            <th key={heading} className="border border-slate-700 bg-[#1f2232] px-3 py-2 font-semibold text-white">
                              {heading}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {section.table.rows.map((row, rowIndex) => (
                          <tr key={rowIndex}>
                            {row.map((cell, cellIndex) => (
                              <td key={cellIndex} className="border border-slate-700 px-3 py-2 align-top">
                                {cell}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : null}
                {section.after?.map((text, index) => (
                  <p key={`a-${index}`} className="mt-2">
                    {text}
                  </p>
                ))}
              </section>
            ))}
          </div>
        </article>
      </section>
    </main>
  );
}
