"use client";

import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { getPublicUser } from "../../../services/users";

export default function PublicUserProfilePage() {
  const params = useParams();
  const userId = typeof params?.id === "string" ? params.id : "";

  const profileQuery = useQuery({
    queryKey: ["public-user", userId],
    queryFn: () => getPublicUser(userId),
    enabled: Boolean(userId),
  });

  return (
    <main className="page-shell">
      <section className="section-shell-wide">
        {profileQuery.isLoading ? (
          <div className="card">Carregando perfil...</div>
        ) : profileQuery.isError ? (
          <div className="card">Nao foi possivel carregar o perfil.</div>
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
                <p className="text-sm font-semibold text-slate-800">Sobre</p>
                <p className="mt-2 text-sm text-muted">{profileQuery.data.bio}</p>
              </div>
            ) : null}

            {profileQuery.data.services ? (
              <div className="mt-4">
                <p className="text-sm font-semibold text-slate-800">Servicos</p>
                <p className="mt-2 text-sm text-muted">{profileQuery.data.services}</p>
              </div>
            ) : null}

            {profileQuery.data.servicesTags?.length ? (
              <div className="mt-4">
                <p className="text-sm font-semibold text-slate-800">Especialidades</p>
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
          <div className="card">Perfil nao encontrado.</div>
        )}
      </section>
    </main>
  );
}
