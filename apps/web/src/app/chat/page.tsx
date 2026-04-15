"use client";

import Link from "next/link";
import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { listConversations } from "../../services/chat";
import { useAuth } from "../../hooks/useAuth";
import { getSocket } from "../../services/realtime";
import { useI18n } from "../../i18n/useI18n";

export default function ChatListPage() {
  const { user, isLoading } = useAuth();
  const { t } = useI18n();

  const conversationsQuery = useQuery({
    queryKey: ["conversations"],
    queryFn: listConversations,
    enabled: Boolean(user),
  });

  useEffect(() => {
    if (!user) return;
    const socket = getSocket();
    const handleUpdate = () => {
      conversationsQuery.refetch();
    };
    socket.on("message.created", handleUpdate);
    socket.on("proposal.updated", handleUpdate);
    return () => {
      socket.off("message.created", handleUpdate);
      socket.off("proposal.updated", handleUpdate);
    };
  }, [user, conversationsQuery]);

  return (
    <main className="page-shell">
      <section className="section-shell">
        <header className="mb-8">
          <h1 className="heading-xl">{t("chat.list.title")}</h1>
          <p className="mt-2 text-muted" id="p">{t("chat.list.subtitle")}</p>
        </header>

        {isLoading ? (
          <div className="card">
            <div className="loader-wrap">
              <div className="loader"></div>
            </div>
          </div>
        ) : conversationsQuery.isLoading ? (
          <div className="card">
            <div className="loader-wrap">
              <div className="loader"></div>
            </div>
          </div>
        ) : conversationsQuery.data && conversationsQuery.data.length > 0 ? (
          <div className="grid gap-4">
            {conversationsQuery.data.map((conversation) => {
              const other =
                user?.id === conversation.client.id ? conversation.freelancer : conversation.client;
              return (
                <div key={conversation.id} className="rounded-2xl border border-slate-200 bg-white px-4 py-4" id="cth">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div >
                      <p  id="pe" className="text-sm font-semibold">{conversation.company.name}</p>
                      {conversation.company.location ? (
                        <p className="mt-1 text-xs text-muted">{conversation.company.location}</p>
                      ) : null}
                      <p className="mt-2 text-sm">
                        {conversation.client.name} · {conversation.freelancer.name}
                      </p>
                    </div>
                    <div  className="flex items-center gap-2">
                      <div className="chip-neutral">{other.name}</div>
                    </div>
                  </div>
                  {conversation.lastMessage ? (
                    <p id="pe" className="mt-3 text-xs text-slate-500">
                      {t("chat.list.lastMessage", { message: conversation.lastMessage.body })}
                    </p>
                  ) : (
                    <p className="mt-3 text-xs text-slate-500">{t("chat.list.noMessages")}</p>
                  )}
                  <div className="mt-4">
                    <Link className="btn-outline" href={`/chat/${conversation.id}`}>
                      {t("chat.list.open")}
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="card">
            <p className="text-sm text-muted">{t("chat.list.empty")}</p>
          </div>
        )}
      </section>
    </main>
  );
}
