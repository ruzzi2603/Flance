"use client";

import { useParams, useRouter } from "next/navigation";
import { useMutation, useQuery } from "@tanstack/react-query";
import { getCompany } from "../../../services/companies";
import { createDirectConversation } from "../../../services/chat";
import { useAuth } from "../../../hooks/useAuth";
import { useState } from "react";
import axios from "axios";

export default function CompanyProfilePage() {
  const params = useParams();
  const router = useRouter();
  const companyId = typeof params?.id === "string" ? params.id : "";
  const { user } = useAuth();
  const [loginWarning, setLoginWarning] = useState(false);
  const [chatError, setChatError] = useState<string | null>(null);

  const profileQuery = useQuery({
    queryKey: ["company", companyId],
    queryFn: () => getCompany(companyId),
    enabled: Boolean(companyId),
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
        setChatError(message || "Nao foi possivel abrir o chat.");
        return;
      }
      setChatError("Nao foi possivel abrir o chat.");
    },
  });

  return (
    <main className="page-shell">
      <section className="section-shell-wide">
        {profileQuery.isLoading ? (
          <div className="card">Carregando perfil...</div>
        ) : profileQuery.isError ? (
          <div className="card">Nao foi possivel carregar o perfil.</div>
        ) : profileQuery.data ? (
          <div className="grid-2-1">
            <div className="card">
              <div className="flex items-center gap-4">
                {profileQuery.data.avatarUrl ? (
                  <img className="avatar-image" src={profileQuery.data.avatarUrl} alt={profileQuery.data.name} />
                ) : (
                  <div className="avatar-fallback">{profileQuery.data.name.slice(0, 2).toUpperCase()}</div>
                )}
                <div>
                  <h1 className="heading-xl">{profileQuery.data.companyName || profileQuery.data.name}</h1>
                  {profileQuery.data.companyLocation ? (
                    <p className="mt-2 text-muted">{profileQuery.data.companyLocation}</p>
                  ) : null}
                </div>
              </div>

              {profileQuery.data.companyDescription ? (
                <div className="mt-4">
                  <p className="text-sm font-semibold text-slate-800">Sobre a empresa</p>
                  <p className="mt-2 text-sm text-muted">{profileQuery.data.companyDescription}</p>
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

              {profileQuery.data.companyHours ? (
                <p className="mt-4 text-sm text-muted">Horario: {profileQuery.data.companyHours}</p>
              ) : null}
              {profileQuery.data.companyIsOnline ? (
                <p className="mt-2 text-sm text-muted">Atendimento online</p>
              ) : null}
              {profileQuery.data.companyIsPhysical ? (
                <p className="mt-1 text-sm text-muted">Atendimento presencial</p>
              ) : null}

              {profileQuery.data.companyPhotos?.length ? (
                <div className="mt-6 grid gap-3 sm:grid-cols-2">
                  {profileQuery.data.companyPhotos.map((photo) => (
                    <img key={photo} className="rounded-2xl border border-slate-200 object-cover" src={photo} alt="Foto" />
                  ))}
                </div>
              ) : null}
            </div>

            <aside className="card">
              <h2 className="heading-lg">Contato</h2>
              <p className="mt-2 text-sm text-muted">
                Converse diretamente com a empresa para tirar duvidas ou solicitar um orcamento.
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
                    setChatError("Voce nao pode abrir chat com sua propria empresa.");
                    return;
                  }
                  conversationMutation.mutate();
                }}
                disabled={conversationMutation.isPending}
              >
                {conversationMutation.isPending ? "Abrindo chat..." : "Falar com a empresa"}
              </button>
              {!user || loginWarning ? (
                <p className="mt-2 text-xs text-slate-500">Faca login para iniciar conversa.</p>
              ) : null}
              {chatError ? (
                <p className="mt-2 text-xs text-rose-600">{chatError}</p>
              ) : null}

              <div className="mt-6 grid gap-2 text-sm text-slate-700">
                {profileQuery.data.companyEmail ? <p>Email: {profileQuery.data.companyEmail}</p> : null}
                {profileQuery.data.companyWhatsapp ? <p>WhatsApp: {profileQuery.data.companyWhatsapp}</p> : null}
                {profileQuery.data.companyInstagram ? <p>Instagram: {profileQuery.data.companyInstagram}</p> : null}
                {profileQuery.data.companyWebsite ? <p>Site: {profileQuery.data.companyWebsite}</p> : null}
                {profileQuery.data.companyAddress ? <p>Endereco: {profileQuery.data.companyAddress}</p> : null}
              </div>
            </aside>
          </div>
        ) : (
          <div className="card">Perfil nao encontrado.</div>
        )}
      </section>
    </main>
  );
}
