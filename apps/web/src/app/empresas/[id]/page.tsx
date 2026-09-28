"use client";

import { useParams, useRouter } from "next/navigation";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  getCompany,
  getCompanyAnalytics,
  listCompanyReviews,
  recordCompanyShare,
  recordCompanyView,
  recordCompanyViewDuration,
  reviewCompany,
} from "../../../services/companies";
import { createDirectConversation } from "../../../services/chat";
import { useAuth } from "../../../hooks/useAuth";
import { useEffect, useState } from "react";
import axios from "axios";
import { useI18n } from "../../../i18n/useI18n";

function getAnalyticsSessionId() {
  const storageKey = "flance_analytics_session";
  let sessionId = sessionStorage.getItem(storageKey);
  if (!sessionId) {
    sessionId = crypto.randomUUID();
    sessionStorage.setItem(storageKey, sessionId);
  }
  return sessionId;
}

function formatDuration(seconds: number) {
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return remainingSeconds ? `${minutes}m ${remainingSeconds}s` : `${minutes}m`;
}

export default function CompanyProfilePage() {
  const params = useParams();
  const router = useRouter();
  const companyId = typeof params?.id === "string" ? params.id : "";
  const { user, isLoading: isAuthLoading } = useAuth();
  const { t } = useI18n();
  const [loginWarning, setLoginWarning] = useState(false);
  const [chatError, setChatError] = useState<string | null>(null);
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");
  const [reviewError, setReviewError] = useState<string | null>(null);
  const [shareNotice, setShareNotice] = useState<string | null>(null);
  const [supportsNativeShare, setSupportsNativeShare] = useState(false);

  const profileQuery = useQuery({
    queryKey: ["company", companyId],
    queryFn: () => getCompany(companyId),
    enabled: Boolean(companyId),
  });

  const reviewsQuery = useQuery({
    queryKey: ["company-reviews", companyId],
    queryFn: () => listCompanyReviews(companyId),
    enabled: Boolean(companyId),
  });

  const isOwner = Boolean(user && user.id === companyId);
  const analyticsQuery = useQuery({
    queryKey: ["company-analytics", companyId],
    queryFn: () => getCompanyAnalytics(companyId),
    enabled: isOwner,
  });

  useEffect(() => {
    setSupportsNativeShare(typeof navigator !== "undefined" && typeof navigator.share === "function");
  }, []);

  useEffect(() => {
    if (!companyId || !profileQuery.data || isAuthLoading || isOwner) return;

    const startedAt = Date.now();
    let visitId: string | null = null;
    let lastDuration = 0;
    let disposed = false;
    const sessionId = getAnalyticsSessionId();

    const flushDuration = () => {
      const durationSeconds = Math.floor((Date.now() - startedAt) / 1000);
      if (!visitId || durationSeconds <= lastDuration) return;
      lastDuration = durationSeconds;
      void recordCompanyViewDuration(companyId, visitId, durationSeconds).catch(() => undefined);
    };

    void recordCompanyView(companyId, sessionId)
      .then((visit) => {
        visitId = visit.id;
        if (disposed) flushDuration();
      })
      .catch(() => undefined);

    const intervalId = window.setInterval(flushDuration, 15_000);
    window.addEventListener("pagehide", flushDuration);
    document.addEventListener("visibilitychange", flushDuration);

    return () => {
      disposed = true;
      window.clearInterval(intervalId);
      window.removeEventListener("pagehide", flushDuration);
      document.removeEventListener("visibilitychange", flushDuration);
      flushDuration();
    };
  }, [companyId, isAuthLoading, isOwner, profileQuery.data]);

  const reviewMutation = useMutation({
    mutationFn: () => reviewCompany(companyId, { rating, comment: comment.trim() || undefined }),
    onSuccess: async () => {
      setReviewError(null);
      setComment("");
      await Promise.all([reviewsQuery.refetch(), profileQuery.refetch()]);
    },
    onError: () => setReviewError(t("companyProfile.reviewError")),
  });

  const conversationMutation = useMutation({
    mutationFn: () => createDirectConversation(companyId),
    onSuccess: (conversation) => {
      setChatError(null);
      router.push(`/chat/${conversation.id}`);
    },
    onError: (error) => {
      if (axios.isAxiosError(error)) {
        const data = error.response?.data as
          | { message?: string | string[]; error?: { message?: string } }
          | undefined;
        const message =
          (typeof data?.message === "string" ? data.message : data?.message?.[0]) ||
          data?.error?.message;
        if (error.response?.status === 401) {
          setLoginWarning(true);
          router.push(`/login?next=/empresas/${companyId}`);
          return;
        }
        setChatError(message || t("companyProfile.contactError"));
        return;
      }
      setChatError(t("companyProfile.contactError"));
    },
  });

  const shareCompany = async (source: "native" | "copy" | "whatsapp" | "facebook" | "x" | "email") => {
    const url = window.location.href;
    const title = profileQuery.data?.companyName || profileQuery.data?.name || document.title;
    try {
      if (source === "native") {
        if (navigator.share) await navigator.share({ title, url });
        else await navigator.clipboard.writeText(url);
      } else if (source === "copy") {
        await navigator.clipboard.writeText(url);
      } else {
        const encodedUrl = encodeURIComponent(url);
        const encodedTitle = encodeURIComponent(title);
        const shareUrls = {
          whatsapp: `https://wa.me/?text=${encodedTitle}%20${encodedUrl}`,
          facebook: `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`,
          x: `https://twitter.com/intent/tweet?text=${encodedTitle}&url=${encodedUrl}`,
          email: `mailto:?subject=${encodedTitle}&body=${encodedUrl}`,
        };
        window.open(shareUrls[source], "_blank", "noopener,noreferrer,width=640,height=520");
      }
      await recordCompanyShare(companyId, getAnalyticsSessionId(), source);
      setShareNotice(t("companyProfile.shareSuccess"));
      if (isOwner) void analyticsQuery.refetch();
    } catch {
      setShareNotice(t("companyProfile.shareError"));
    }
  };

  return (
    <main className="page-shell" id="Remember">
      <section className="section-shell-wide">
        {profileQuery.isLoading ? (
          <div className="card">
            <div className="loader-wrap">
              <div className="loader"></div>
            </div>
          </div>
        ) : profileQuery.isError ? (
          <div className="card">{t("companyProfile.loadError")}</div>
        ) : profileQuery.data ? (
          <div className="grid-2-1">
            <div className="card company-profile-medal-anchor" >
              {profileQuery.data.reviewMedal ? (
                <span
                  className={`company-medal company-medal-${profileQuery.data.reviewMedal}`}
                  title={t(`companyProfile.medal.${profileQuery.data.reviewMedal}`, { count: profileQuery.data.qualifiedReviewCount })}
                  aria-label={t(`companyProfile.medal.${profileQuery.data.reviewMedal}`, { count: profileQuery.data.qualifiedReviewCount })}
                >
                  {profileQuery.data.reviewMedal === "gold" ? "🥇" : profileQuery.data.reviewMedal === "silver" ? "🥈" : "🥉"}
                </span>
              ) : null}
              <div className="flex items-center gap-4" >
                {profileQuery.data.avatarUrl ? (
                  <img className="avatar-image" src={profileQuery.data.avatarUrl} alt={profileQuery.data.name} />
                ) : (
                  <div className="avatar-fallback">{profileQuery.data.name.slice(0, 2).toUpperCase()}</div>
                )}
                <div>
                  <h1 className="heading-xl"id="Remember">{profileQuery.data.companyName || profileQuery.data.name}</h1>
                  {profileQuery.data.companyLocation ? (
                  <p className="mt-2 text-muted" id="Remember">{profileQuery.data.companyLocation}</p>
                ) : null}
                </div>
              </div>

              {profileQuery.data.companyDescription ? (
                <div className="mt-4" id="Remember">
                  <p className="text-sm font-semibold text-slate-800" id="Remember">{t("companyProfile.about")}</p>
                  <p className="mt-2 text-sm text-muted" id="Remember">{profileQuery.data.companyDescription}</p>
                </div>
              ) : null}

              {profileQuery.data.services ? (
                <div className="mt-4">
                  <p className="text-sm font-semibold text-slate-800" id="Remember">{t("companyProfile.services")}</p>
                  <p className="mt-2 text-sm text-muted"  id="Remember">{profileQuery.data.services}</p>
                </div>
              ) : null}

              {profileQuery.data.servicesTags?.length ? (
                <div className="mt-4">
                  <p className="text-sm font-semibold text-slate-800" id="Remember">{t("companyProfile.specialties")}</p>
                  <div className="mt-2 flex flex-wrap gap-2" id="Remember">
                    {profileQuery.data.servicesTags.map((tag) => (
                      <span key={tag} className="chip-neutral">
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              ) : null}

              {profileQuery.data.companyHours ? (
                <p className="mt-4 text-sm text-muted" id="Remember">
                  {t("companyProfile.hours", { value: profileQuery.data.companyHours })}
                </p>
              ) : null}
              {profileQuery.data.companyIsOnline ? (
                <p className="mt-2 text-sm text-muted" id="Remember">
                  {t("companyProfile.online")}
                </p>
              ) : null}
              {profileQuery.data.companyIsPhysical ? (
                <p className="mt-1 text-sm text-muted" id="Remember">
                  {t("companyProfile.physical")}
                </p>
              ) : null}

              <div className="mt-6 border-t border-slate-200 pt-5">
                <div className="flex flex-wrap items-center gap-3">
                  <h2 className="heading-lg">{t("companyProfile.reviewsTitle")}</h2>
                  <span className="text-amber-500" aria-label={`${profileQuery.data.averageRating} de 5 estrelas`}>
                    {"★".repeat(Math.round(profileQuery.data.averageRating))}{"☆".repeat(5 - Math.round(profileQuery.data.averageRating))}
                  </span>
                  <span className="text-sm text-muted">
                    {profileQuery.data.averageRating > 0 ? profileQuery.data.averageRating.toFixed(1) : "-"} ({profileQuery.data.reviewCount})
                  </span>
                  {profileQuery.data.isTrusted ? <span className="chip-neutral">{t("companyProfile.trusted")}</span> : null}
                </div>

                {user ? (
                  <form
                    className="mt-4 grid gap-3"
                    onSubmit={(event) => {
                      event.preventDefault();
                      if (rating > 0) reviewMutation.mutate();
                    }}
                  >
                    <div className="flex gap-1" aria-label={t("companyProfile.chooseRating")}>
                      {[1, 2, 3, 4, 5].map((value) => (
                        <button
                          key={value}
                          type="button"
                          className="text-2xl text-amber-500"
                          aria-label={`${value} estrelas`}
                          onClick={() => setRating(value)}
                        >
                          {value <= rating ? "★" : "☆"}
                        </button>
                      ))}
                    </div>
                    <textarea
                      className="input min-h-24"
                      placeholder={t("companyProfile.commentPlaceholder")}
                      value={comment}
                      onChange={(event) => setComment(event.target.value)}
                      maxLength={1000}
                    />
                    <button className="btn-primary w-fit" type="submit" disabled={rating === 0 || reviewMutation.isPending}>
                      {reviewMutation.isPending ? t("companyProfile.reviewSaving") : t("companyProfile.reviewSubmit")}
                    </button>
                    {reviewError ? <p className="text-xs text-rose-600">{reviewError}</p> : null}
                  </form>
                ) : (
                  <p className="mt-3 text-sm text-muted">{t("companyProfile.reviewLogin")}</p>
                )}

                <div className="mt-5 grid gap-4">
                  {reviewsQuery.data?.length ? reviewsQuery.data.map((review) => (
                    <article key={review.id} className="border-b border-slate-100 pb-3">
                      <div className="flex items-center justify-between gap-3">
                        <strong className="text-sm text-slate-800">{review.author.name}</strong>
                        <span className="text-sm text-amber-500">{"★".repeat(review.rating)}{"☆".repeat(5 - review.rating)}</span>
                      </div>
                      {review.comment ? <p className="mt-1 text-sm text-muted">{review.comment}</p> : null}
                    </article>
                  )) : <p className="text-sm text-muted">{t("companyProfile.noReviews")}</p>}
                </div>
              </div>

              {profileQuery.data.companyPhotos?.length ? (
              <div className="fotosCarrosel">
  {profileQuery.data.companyPhotos.map((photo) => (
    <img
      key={photo}
      className="rounded-2xl object-cover"
      src={photo}
      alt="Foto demonstrativa da empresa"
    />
  ))}
</div>

              ) : null}
            </div>

            <aside className="card">
              <h2 className="heading-lg">{t("companyProfile.contactTitle")}</h2>
              <p className="mt-2 text-sm text-muted" id="Remember">
                {t("companyProfile.contactSubtitle")}
              </p>
              <button
                className="btn-primary mt-4"
                onClick={() => {
                  if (!user) {
                    setLoginWarning(true);
                    router.push(`/login?next=/empresas/${companyId}`);
                    return;
                  }
                  if (user.id === companyId) {
                    setChatError(t("companyProfile.contactSelf"));
                    return;
                  }
                  conversationMutation.mutate();
                }}
                disabled={conversationMutation.isPending}
              >
                {conversationMutation.isPending
                  ? t("companyProfile.contactOpening")
                  : t("companyProfile.contactButton")}
              </button>
              {!user || loginWarning ? (
                <p className="mt-2 text-xs text-slate-500" id="Remember">{t("companyProfile.contactLogin")}</p>
              ) : null}
              {chatError ? (
                <p className="mt-2 text-xs text-rose-600">{chatError}</p>
              ) : null}

              <div className="mt-6 grid gap-2 text-sm text-slate-700" id="Remember">
                {profileQuery.data.companyEmail ? (
                  <p>{t("companyProfile.contactEmail", { value: profileQuery.data.companyEmail })}</p>
                ) : null}
                {profileQuery.data.companyWhatsapp ? (
                  <p>{t("companyProfile.contactWhatsapp", { value: profileQuery.data.companyWhatsapp })}</p>
                ) : null}
                {profileQuery.data.companyInstagram ? (
                  <p>{t("companyProfile.contactInstagram", { value: profileQuery.data.companyInstagram })}</p>
                ) : null}
                {profileQuery.data.companyWebsite ? (
                  <p>{t("companyProfile.contactWebsite", { value: profileQuery.data.companyWebsite })}</p>
                ) : null}
                {profileQuery.data.companyAddress ? (
                  <p>{t("companyProfile.contactAddress", { value: profileQuery.data.companyAddress })}</p>
                ) : null}
              </div>

              <div className="mt-6 border-t border-slate-200 pt-5">
                <h2 className="heading-lg">{t("companyProfile.shareTitle")}</h2>
                <div className="mt-3 flex flex-wrap gap-2">
                  {supportsNativeShare ? (
                    <button className="btn-outline" type="button" onClick={() => void shareCompany("native")}>
                      {t("companyProfile.shareNative")}
                    </button>
                  ) : null}
                  <button className="btn-outline" type="button" onClick={() => void shareCompany("copy")}>{t("companyProfile.shareCopy")}</button>
                  <button className="btn-outline" type="button" onClick={() => void shareCompany("whatsapp")}>WhatsApp</button>
                  <button className="btn-outline" type="button" onClick={() => void shareCompany("facebook")}>Facebook</button>
                  <button className="btn-outline" type="button" onClick={() => void shareCompany("x")}>X</button>
                  <button className="btn-outline" type="button" onClick={() => void shareCompany("email")}>{t("companyProfile.shareEmail")}</button>
                </div>
                {shareNotice ? <p className="mt-2 text-xs text-muted" role="status">{shareNotice}</p> : null}
              </div>
            </aside>
          </div>
        ) : null}

        {isOwner && profileQuery.data ? (
          <section className="company-analytics-panel mt-8" aria-labelledby="company-analytics-title">
            <header className="company-analytics-header">
              <div>
                <p className="company-analytics-eyebrow">{t("companyProfile.analyticsEyebrow")}</p>
                <h2 className="heading-lg" id="company-analytics-title">{t("companyProfile.analyticsTitle")}</h2>
                <p className="mt-1 text-sm text-muted">{t("companyProfile.analyticsPeriod")}</p>
              </div>
              <span className="company-analytics-live"><span />{t("companyProfile.analyticsUpdated")}</span>
            </header>

            {analyticsQuery.isLoading ? (
              <div className="company-analytics-loading" aria-label={t("common.loading")} />
            ) : analyticsQuery.isError ? (
              <p className="mt-5 text-sm text-rose-600">{t("companyProfile.analyticsError")}</p>
            ) : analyticsQuery.data ? (
              <>
                <div className="company-analytics-stats">
                  <article className="company-analytics-stat company-analytics-stat-views">
                    <span>{t("companyProfile.analyticsViews")}</span>
                    <strong>{analyticsQuery.data.views.toLocaleString()}</strong>
                    <small>{t("companyProfile.analyticsTotalViews")}</small>
                  </article>
                  <article className="company-analytics-stat company-analytics-stat-time">
                    <span>{t("companyProfile.analyticsTime")}</span>
                    <strong>{formatDuration(analyticsQuery.data.averageDurationSeconds)}</strong>
                    <small>{t("companyProfile.analyticsAverage")}</small>
                  </article>
                  <article className="company-analytics-stat company-analytics-stat-messages">
                    <span>{t("companyProfile.analyticsMessages")}</span>
                    <strong>{analyticsQuery.data.messages.toLocaleString()}</strong>
                    <small>{t("companyProfile.analyticsPeople", { count: analyticsQuery.data.peopleContacted })}</small>
                  </article>
                  <article className="company-analytics-stat company-analytics-stat-shares">
                    <span>{t("companyProfile.analyticsShares")}</span>
                    <strong>{analyticsQuery.data.shares.toLocaleString()}</strong>
                    <small>{t("companyProfile.analyticsTotalShares")}</small>
                  </article>
                </div>

                <div className="company-analytics-chart-wrap">
                  <div className="company-analytics-chart-title">
                    <h3>{t("companyProfile.analyticsChart")}</h3>
                    <div className="company-analytics-legend">
                      <span><i className="legend-views" />{t("companyProfile.analyticsViews")}</span>
                      <span><i className="legend-messages" />{t("companyProfile.analyticsMessages")}</span>
                      <span><i className="legend-shares" />{t("companyProfile.analyticsShares")}</span>
                    </div>
                  </div>
                  {(() => {
                    const maxValue = Math.max(1, ...analyticsQuery.data.daily.flatMap((day) => [day.views, day.messages, day.shares]));
                    return (
                      <div className="company-analytics-chart" role="img" aria-label={t("companyProfile.analyticsChartDescription")}>
                        {analyticsQuery.data.daily.map((day, index) => {
                          const labelDate = new Date(`${day.date}T12:00:00Z`);
                          return (
                            <div className="company-analytics-day" key={day.date} title={`${day.date}: ${day.views} / ${day.messages} / ${day.shares}`}>
                              <div className="company-analytics-bars">
                                <i className="bar-views" style={{ height: `${Math.max(day.views ? 4 : 2, (day.views / maxValue) * 100)}%`, animationDelay: `${index * 12}ms` }} />
                                <i className="bar-messages" style={{ height: `${Math.max(day.messages ? 4 : 2, (day.messages / maxValue) * 100)}%`, animationDelay: `${index * 12 + 40}ms` }} />
                                <i className="bar-shares" style={{ height: `${Math.max(day.shares ? 4 : 2, (day.shares / maxValue) * 100)}%`, animationDelay: `${index * 12 + 80}ms` }} />
                              </div>
                              {index % 5 === 0 || index === 29 ? <small>{labelDate.getUTCDate()}</small> : null}
                            </div>
                          );
                        })}
                      </div>
                    );
                  })()}
                </div>

                <div className="company-analytics-sources">
                  <h3>{t("companyProfile.analyticsSources")}</h3>
                  {analyticsQuery.data.shareSources.length ? analyticsQuery.data.shareSources.map((source) => (
                    <div className="company-analytics-source" key={source.source}>
                      <span>{t(`companyProfile.shareSource.${source.source}`)}</span>
                      <strong>{source.count}</strong>
                    </div>
                  )) : <p className="text-sm text-muted">{t("companyProfile.analyticsNoShares")}</p>}
                </div>
              </>
            ) : null}
          </section>
        ) : null}
      </section>
    </main>
  );
}
