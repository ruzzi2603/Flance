"use client";

import { useParams, useRouter } from "next/navigation";
import { useMutation, useQuery } from "@tanstack/react-query";
import { getCompany, listCompanyReviews, reviewCompany } from "../../../services/companies";
import { createDirectConversation } from "../../../services/chat";
import { useAuth } from "../../../hooks/useAuth";
import { useState } from "react";
import axios from "axios";
import { useI18n } from "../../../i18n/useI18n";

export default function CompanyProfilePage() {
  const params = useParams();
  const router = useRouter();
  const companyId = typeof params?.id === "string" ? params.id : "";
  const { user } = useAuth();
  const { t } = useI18n();
  const [loginWarning, setLoginWarning] = useState(false);
  const [chatError, setChatError] = useState<string | null>(null);
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");
  const [reviewError, setReviewError] = useState<string | null>(null);

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
            </aside>
          </div>
        ) : (
          <div className="card">{t("companyProfile.notFound")}</div>
        )}
      </section>
    </main>
  );
}
