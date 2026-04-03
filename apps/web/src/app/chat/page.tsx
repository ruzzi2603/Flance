"use client";

import Link from "next/link";
import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { listConversations } from "../../services/chat";
import { useAuth } from "../../hooks/useAuth";
import { getSocket } from "../../services/realtime";

export default function ChatListPage() {
  const { user, isLoading } = useAuth();

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
          <h1 className="heading-xl">Chats</h1>
          <p className="mt-2 text-muted">Conversas em andamento com empresas e clientes.</p>
        </header>

        {isLoading ? (
          <div className="card">Carregando...</div>
        ) : conversationsQuery.isLoading ? (
          <div className="card">Carregando conversas...</div>
        ) : conversationsQuery.data && conversationsQuery.data.length > 0 ? (
          <div className="grid gap-4">
            {conversationsQuery.data.map((conversation) => {
              const other =
                user?.id === conversation.client.id ? conversation.freelancer : conversation.client;
              return (
                <div key={conversation.id} className="rounded-2xl border border-slate-200 bg-white px-4 py-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold">{conversation.company.name}</p>
                      {conversation.company.location ? (
                        <p className="mt-1 text-xs text-muted">{conversation.company.location}</p>
                      ) : null}
                      <p className="mt-2 text-sm text-slate-700">
                        {conversation.client.name} · {conversation.freelancer.name}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="chip-neutral">{other.name}</div>
                    </div>
                  </div>
                  {conversation.lastMessage ? (
                    <p className="mt-3 text-xs text-slate-500">
                      Ultima mensagem: {conversation.lastMessage.body}
                    </p>
                  ) : (
                    <p className="mt-3 text-xs text-slate-500">Sem mensagens ainda.</p>
                  )}
                  <div className="mt-4">
                    <Link className="btn-outline" href={`/chat/${conversation.id}`}>
                      Abrir chat
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="card">
            <p className="text-sm text-muted">Nenhuma conversa encontrada.</p>
          </div>
        )}
      </section>
    </main>
  );
}

