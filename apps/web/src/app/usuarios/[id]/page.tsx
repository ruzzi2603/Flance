"use client";

import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { getPublicUser } from "../../../services/users";
import { useI18n } from "../../../i18n/useI18n";

export default function PublicUserProfilePage() {
  const params = useParams();
  const userId = typeof params?.id === "string" ? params.id : "";
  const { t } = useI18n();

  const profileQuery = useQuery({
    queryKey: ["public-user", userId],
    queryFn: () => getPublicUser(userId),
    enabled: Boolean(userId),
  });

  return (
    <main className="page-shell">
      <section className="section-shell-wide">
        {profileQuery.isLoading ? (
          <div className="card">
            <div className="loader-wrap">
              <div className="loader"></div>
            </div>
          </div>
        ) : profileQuery.isError ? (
          <div className="card">{t("publicProfile.loadError")}</div>
        ) : profileQuery.data ? (
          <div className="card">
            <div className="flex items-center gap-4">
              {profileQuery.data.avatarUrl ? (
                <img className="avatar-image" src={profileQuery.data.avatarUrl} alt={profileQuery.data.name} />
              ) : (
                <div className="avatar-fallback">
                  {profileQuery.data.name.slice(0, 2).toUpperCase()}
                </div>
              )}
              <div>
                <h1 className="heading-xl">{profileQuery.data.name}</h1>
                {profileQuery.data.headline ? (
                  <p className="mt-2 text-muted">{profileQuery.data.headline}</p>
                ) : null}
              </div>
            </div>

            {profileQuery.data.bio ? (
              <div className="mt-4">
                <p className="text-sm font-semibold text-slate-800">{t("publicProfile.about")}</p>
                <p className="mt-2 text-sm text-muted">{profileQuery.data.bio}</p>
              </div>
            ) : null}

            {profileQuery.data.services ? (
              <div className="mt-4">
                <p className="text-sm font-semibold text-slate-800">{t("publicProfile.services")}</p>
                <p className="mt-2 text-sm text-muted">{profileQuery.data.services}</p>
              </div>
            ) : null}

            {profileQuery.data.servicesTags?.length ? (
              <div className="mt-4">
                <p className="text-sm font-semibold text-slate-800">{t("publicProfile.specialties")}</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {profileQuery.data.servicesTags.map((tag) => (
                    <span key={tag} className="chip-neutral">
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        ) : (
          <div className="card">{t("publicProfile.notFound")}</div>
        )}
      </section>
    </main>
  );
}
