"use client";

import { useState } from "react";
import { useInfiniteQuery } from "@tanstack/react-query";
import { listCompanies } from "../../services/companies";
import { useI18n } from "../../i18n/useI18n";

export default function CompaniesPage() {
  const [search, setSearch] = useState("");
  const { t } = useI18n();
  const companiesQuery = useInfiniteQuery({
    queryKey: ["companies", search],
    queryFn: ({ pageParam = 0 }) => listCompanies({ query: search, limit: 40, offset: pageParam }),
    getNextPageParam: (lastPage, allPages) => (lastPage.length === 40 ? allPages.length * 40 : undefined),
    initialPageParam: 0,
  });
  const companies = companiesQuery.data?.pages.flat() ?? [];

  return (
    <main className="page-shell">
      <section className="section-shell">
        <header className="mb-8">
          <h1 className="heading-xl">{t("companies.title")}</h1>
          <p className="mt-2 text-muted" id="p">
            {t("companies.subtitle")}
          </p>
          <div className="mt-4 max-w-xl">
            <input
              className="input"
              placeholder={t("companies.search")}
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </div>
        </header>

        {companiesQuery.isLoading ? (
          <div className="card">
            <div className="loader-wrap">
              <div className="loader"></div>
            </div>
          </div>
        ) : companiesQuery.isError ? (
          <div className="card">{t("companies.loadError")}</div>
        ) : companies.length ? (
          <div className="company-list">
            {companies.map((company) => {
              const photos = company.companyPhotos?.filter(Boolean) ?? [];
              const visiblePhotos = photos.slice(0, 3);
              return (
                <article key={company.id} className="company-card">
                  <div className="company-card-main">
                    <div className="company-card-meta">
                      {company.avatarUrl ? (
                        <img className="avatar-image" src={company.avatarUrl} alt={company.name} />
                      ) : (
                        <div className="avatar-fallback">{company.name.slice(0, 2).toUpperCase()}</div>
                      )}
                      <div>
                        <h2 className="heading-lg">{company.companyName || company.name}</h2>
                        {company.companyLocation ? (
                          <p className="text-sm text-muted">{company.companyLocation}</p>
                        ) : null}
                      </div>
                    </div>

                    {company.companyDescription ? (
                      <p className="text-sm text-muted">{company.companyDescription}</p>
                    ) : company.services ? (
                      <p className="text-sm text-muted">{company.services}</p>
                    ) : null}

                    {company.servicesTags?.length ? (
                      <div className="flex flex-wrap gap-2">
                        {company.servicesTags.map((tag) => (
                          <span key={tag} className="chip-neutral">
                            {tag}
                          </span>
                        ))}
                      </div>
                    ) : null}

                    <div className="mt-2">
                      <a className="btn-primary-sm" href={`/empresas/${company.id}`}>
                        {t("companies.viewProfile")}
                      </a>
                    </div>
                  </div>

                  <div className="company-card-photos">
                    {visiblePhotos.length ? (
                      visiblePhotos.map((photo) => (
                        <img key={photo} src={photo} alt="Foto da empresa" />
                      ))
                    ) : (
                      <div className="text-sm text-muted">{t("companies.noPhotos")}</div>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        ) : (
          <div className="card">{t("companies.empty")}</div>
        )}
        {companiesQuery.hasNextPage ? (
          <div className="mt-6 flex justify-center">
            <button
              className="btn-outline"
              onClick={() => companiesQuery.fetchNextPage()}
              disabled={companiesQuery.isFetchingNextPage}
            >
              {companiesQuery.isFetchingNextPage ? (
                <div className="flex items-center justify-center gap-2">
                  <div className="loader loader-sm"></div>
                  <span>{t("common.loading")}</span>
                </div>
              ) : (
                t("companies.loadMore")
              )}
            </button>
          </div>
        ) : null}
      </section>
    </main>
  );
}
