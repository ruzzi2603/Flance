"use client";

import Link from "next/link";
import axios from "axios";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getCompany } from "../../services/companies";
import { updateProfile } from "../../services/users";
import { useAuth } from "../../hooks/useAuth";
import { useI18n } from "../../i18n/useI18n";
import { useAuthStore } from "../../store/useAuthStore";

export default function MyAdsPage() {
  const { user, isLoading } = useAuth();
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const { setUser } = useAuthStore();
  const companyQuery = useQuery({
    queryKey: ["my-company-ad", user?.id],
    queryFn: () => getCompany(user!.id),
    enabled: Boolean(user && (user.role === "FREELANCER" || user.companyEnabled)),
    retry: false,
  });

  const isMissingAd = axios.isAxiosError(companyQuery.error) && companyQuery.error.response?.status === 404;
  const hasAd = Boolean(companyQuery.data);
  const deleteAdMutation = useMutation({
    mutationFn: () => updateProfile({ companyEnabled: false }),
    onSuccess: (updated) => {
      setUser(updated);
      void queryClient.invalidateQueries({ queryKey: ["my-company-ad", updated.id] });
    },
  });

  function handleDeleteAd() {
    if (window.confirm(t("myAds.deleteConfirm"))) deleteAdMutation.mutate();
  }

  return (
    <main className="page-shell">
      <section className="section-shell my-ads-page">
        <header className="my-ads-header">
          <div>
            <p className="my-ads-eyebrow" >{t("myAds.eyebrow")}</p>
            <h1 className="heading-xl" >{t("myAds.title")}</h1>
            <p className="mt-2 text-muted"  >{t("myAds.subtitle")}</p>
          </div>
          {hasAd ? <span className="my-ads-count">{t("myAds.activeCount", { count: 1 })}</span> : null}
        </header>

        {isLoading || companyQuery.isLoading ? (
          <div className="card mt-6">
            <div className="loader-wrap"><div className="loader" /></div>
          </div>
        ) : !user ? (
          <div className="my-ads-empty mt-6">
            <h2 className="heading-lg">{t("myAds.loginTitle")}</h2>
            <p className="mt-2 text-muted">{t("myAds.loginDescription")}</p>
            <Link className="btn-primary mt-5 inline-flex" href="/login?next=/meus-anuncios">
              {t("myAds.loginButton")}
            </Link>
          </div>
        ) : companyQuery.data ? (
          <article className="my-ad-listing mt-6" id="cardMeuAnuncio">
            <div className="my-ad-image-wrap">
              {companyQuery.data.companyPhotos?.[0] ? (
                <img src={companyQuery.data.companyPhotos[0]} alt={companyQuery.data.companyName || companyQuery.data.name} />
              ) : (
                <div className="my-ad-image-fallback">{(companyQuery.data.companyName || companyQuery.data.name).slice(0, 1).toUpperCase()}</div>
              )}
              <span className="my-ad-status"><i />{t("myAds.active")}</span>
            </div>
            <div className="my-ad-content">
              <div className="my-ad-title-row">
                <div>
                  <p className="my-ads-eyebrow" id="wt">{t("myAds.listingLabel")}</p>
                  <h2 className="heading-lg" id="wt">{companyQuery.data.companyName || companyQuery.data.name}</h2>
                  {companyQuery.data.companyLocation ? <p className="mt-1 text-sm text-muted" id="wt">{companyQuery.data.companyLocation}</p> : null}
                </div>
                {companyQuery.data.reviewMedal ? (
                  <span
                    className={`company-medal company-medal-${companyQuery.data.reviewMedal} my-ad-medal`}
                    title={t(`companyProfile.medal.${companyQuery.data.reviewMedal}`, { count: companyQuery.data.qualifiedReviewCount })}
                    aria-label={t(`companyProfile.medal.${companyQuery.data.reviewMedal}`, { count: companyQuery.data.qualifiedReviewCount })}
                  >
                    {companyQuery.data.reviewMedal === "gold" ? "🥇" : companyQuery.data.reviewMedal === "silver" ? "🥈" : "🥉"}
                  </span>
                ) : null}
              </div>
              <p className="my-ad-description" id="wt">
                {companyQuery.data.companyDescription || companyQuery.data.services || t("myAds.noDescription")}
              </p>
              <div className="my-ad-summary">
                <span><b>{companyQuery.data.averageRating > 0 ? companyQuery.data.averageRating.toFixed(1) : "-"}</b> {t("myAds.rating")}</span>
                <span><b>{companyQuery.data.reviewCount}</b> {t("myAds.reviews")}</span>
                {companyQuery.data.isTrusted ? <span className="chip-success">{t("companies.trusted")}</span> : null}
              </div>
              <div className="my-ad-actions">
                <Link className="btn-primary" href={`/empresas/${companyQuery.data.id}`}>{t("myAds.viewAd")}</Link>
                <Link className="btn-outline" href="/profile?edit=company">{t("myAds.editAd")}</Link>
                <button className="btn-danger" type="button" onClick={handleDeleteAd} disabled={deleteAdMutation.isPending}>
                  {deleteAdMutation.isPending ? t("myAds.deleting") : t("myAds.delete")}
                </button>
                {user.planTier && user.planTier !== "FREE" ? (
                  <Link className="btn-outline" href="/assinatura">{t("myAds.managePlan")}</Link>
                ) : null}
              </div>
              {deleteAdMutation.isError ? <p className="my-ad-delete-error" role="alert">{t("myAds.deleteError")}</p> : null}
            </div>
          </article>
        ) : companyQuery.isError && !isMissingAd ? (
          <div className="my-ads-empty mt-6">
            <h2 className="heading-lg">{t("myAds.loadErrorTitle")}</h2>
            <p className="mt-2 text-muted">{t("myAds.loadErrorDescription")}</p>
            <button className="btn-outline mt-5" onClick={() => void companyQuery.refetch()}>{t("myAds.retry")}</button>
          </div>
        ) : (
          <div className="my-ads-empty mt-6">
            <span className="my-ads-empty-mark" aria-hidden="true">+</span>
            <h2 className="heading-lg">{t("myAds.emptyTitle")}</h2>
            <p className="mt-2 text-muted">{t("myAds.emptyDescription")}</p>
            <Link className="btn-primary mt-5 inline-flex" href="/profile?edit=company">{t("myAds.createButton")}</Link>
          </div>
        )}
      </section>
    </main>
  );
}
