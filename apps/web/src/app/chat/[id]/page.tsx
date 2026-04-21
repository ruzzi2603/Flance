"use client";

import { useMemo, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { listMessages, sendMessage } from "../../../services/chat";
import { updateProposalBid, updateProposalStatus } from "../../../services/proposals";
import { useAuth } from "../../../hooks/useAuth";
import { getSocket } from "../../../services/realtime";
import type { MessageEntity } from "@flance/types";
import { useI18n } from "../../../i18n/useI18n";

export default function ChatPage() {
  const params = useParams();
  const router = useRouter();
  const conversationId = typeof params?.id === "string" ? params.id : "";
  const { user } = useAuth();
  const { t, formatCurrency } = useI18n();
  const [message, setMessage] = useState("");
  const [participantNames, setParticipantNames] = useState<Record<string, string>>({});
  const [conversationInfo, setConversationInfo] = useState<{
    company: { id: string; name: string; location?: string | null };
    client: { id: string; name: string; avatarUrl?: string | null };
    freelancer: { id: string; name: string; avatarUrl?: string | null };
  } | null>(null);
  const [editBidOpen, setEditBidOpen] = useState(false);
  const [bidInput, setBidInput] = useState("");
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const queryClient = useQueryClient();

  const messagesQuery = useQuery({
    queryKey: ["chat", conversationId],
    queryFn: () => listMessages(conversationId),
    enabled: Boolean(conversationId),
  });

  const proposalQuery = useQuery({
    queryKey: ["chat-proposal", conversationId],
    queryFn: async () => {
      const response = await fetch(`/api/conversations/${conversationId}/proposal`);
      if (!response.ok) return null;
      const data = (await response.json()) as {
        proposal: {
          id: string;
          status: "PENDING" | "ACCEPTED" | "REJECTED" | "CANCELLED";
          bidAmount: number;
          text: string;
          job: { id: string; title: string };
          clientId: string;
          freelancerId: string;
        } | null;
      };
      return data.proposal;
    },
    enabled: Boolean(conversationId),
  });

  const sendMutation = useMutation({
    mutationFn: (body: string) => sendMessage(conversationId, body),
    onMutate: async (body) => {
      if (!conversationId || !user?.id) return;
      await queryClient.cancelQueries({ queryKey: ["chat", conversationId] });
      const previous = queryClient.getQueryData<MessageEntity[]>(["chat", conversationId]) ?? [];
      const tempId = `temp-${Date.now()}`;
      const optimistic: MessageEntity = {
        id: tempId,
        conversationId,
        senderId: user.id,
        body,
        createdAt: new Date().toISOString(),
      };
      queryClient.setQueryData<MessageEntity[]>(["chat", conversationId], [...previous, optimistic]);
      setMessage("");
      return { previous, tempId };
    },
    onSuccess: (data, _body, context) => {
      if (!conversationId) return;
      queryClient.setQueryData<MessageEntity[]>(["chat", conversationId], (current = []) => {
        const withoutTemp = context?.tempId ? current.filter((item) => item.id !== context.tempId) : current;
        if (withoutTemp.some((item) => item.id === data.id)) {
          return withoutTemp;
        }
        return [...withoutTemp, data];
      });
    },
    onError: (_error, _body, context) => {
      if (context?.previous) {
        queryClient.setQueryData(["chat", conversationId], context.previous);
      }
    },
  });

  const updateStatusMutation = useMutation({
    mutationFn: (status: "ACCEPTED" | "REJECTED") => {
      if (!proposalQuery.data) throw new Error("Proposal not found");
      return updateProposalStatus(proposalQuery.data.id, status);
    },
    onSuccess: (data) => {
      queryClient.setQueryData(["chat-proposal", conversationId], (current) =>
        current ? { ...current, status: data.status } : current,
      );
    },
  });

  const updateBidMutation = useMutation({
    mutationFn: (amount: number) => {
      if (!proposalQuery.data) throw new Error("Proposal not found");
      return updateProposalBid(proposalQuery.data.id, amount);
    },
    onSuccess: (data) => {
      queryClient.setQueryData(["chat-proposal", conversationId], (current) =>
        current ? { ...current, bidAmount: data.bidAmount } : current,
      );
      setEditBidOpen(false);
      setBidInput("");
    },
  });

  const orderedMessages = useMemo(() => messagesQuery.data ?? [], [messagesQuery.data]);
  const sortedMessages = useMemo(() => orderedMessages ?? [], [orderedMessages]);

  useEffect(() => {
    if (!conversationId) return;
    const socket = getSocket();
    socket.emit("join.conversation", { conversationId });
    const handleMessage = (payload: { conversationId: string; message?: MessageEntity }) => {
      if (payload.conversationId === conversationId) {
        if (payload.message) {
          const msg = payload.message;
          queryClient.setQueryData<MessageEntity[]>(["chat", conversationId], (current = []) => {
            if (current.some((item) => item.id === msg.id)) {
              return current;
            }
            return [...current, msg];
          });
          return;
        }
        messagesQuery.refetch();
      }
    };
    const handleProposalUpdate = (payload: { conversationId?: string }) => {
      if (payload.conversationId && payload.conversationId !== conversationId) return;
      proposalQuery.refetch();
    };
    socket.on("message.created", handleMessage);
    socket.on("proposal.updated", handleProposalUpdate);
    return () => {
      socket.emit("leave.conversation", { conversationId });
      socket.off("message.created", handleMessage);
      socket.off("proposal.updated", handleProposalUpdate);
    };
  }, [conversationId, messagesQuery, queryClient, proposalQuery]);

  useEffect(() => {
    if (!messagesQuery.data?.length) return;
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messagesQuery.data]);

  useEffect(() => {
    async function loadParticipants() {
      if (!conversationId) return;
      try {
        const response = await fetch(`/api/conversations/${conversationId}/participants`);
        if (!response.ok) return;
        const data = (await response.json()) as {
          participants: Record<string, string>;
          conversation?: {
            company: { id: string; name: string; location?: string | null };
            client: { id: string; name: string; avatarUrl?: string | null };
            freelancer: { id: string; name: string; avatarUrl?: string | null };
          };
        };
        setParticipantNames(data.participants ?? {});
        if (data.conversation) {
          setConversationInfo(data.conversation);
        }
      } catch {
        return;
      }
    }

    loadParticipants();
  }, [conversationId]);

  function handleSend(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const body = message.trim();
    if (!body) return;
    sendMutation.mutate(body);
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      const body = message.trim();
      if (!body || sendMutation.isPending) return;
      sendMutation.mutate(body);
    }
  }

  return (
    <main className="page-shell">
      <section className="section-shell">
        <header className="mb-6">
          <h1 className="heading-xl">{t("chat.title")}</h1>
          <p className="mt-1 text-muted">{t("chat.subtitle")}</p>
        </header>

        <div className="cardC">
          {conversationInfo && user?.id ? (
            <div id="chatcd" className="mb-6 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
              {user.id === conversationInfo.client.id ? (
                <button
                  type="button"
                  className="flex items-center gap-3 text-left"
                  onClick={() => router.push(`/empresas/${conversationInfo.company.id}`)}
                >
                  {conversationInfo.freelancer.avatarUrl ? (
                    <img
                      className="avatar-image"
                      src={conversationInfo.freelancer.avatarUrl}
                      alt={conversationInfo.company.name}
                    />
                  ) : (
                    <div className="avatar-fallback">{conversationInfo.company.name.slice(0, 2).toUpperCase()}</div>
                  )}
                  <div>
                    <p className="text-sm font-semibold">{conversationInfo.company.name}</p>
                    {conversationInfo.company.location ? (
                      <p className="text-xs text-muted">{conversationInfo.company.location}</p>
                    ) : null}
                  </div>
                </button>
              ) : (
                <button
                  type="button"
                  className="flex items-center gap-3 text-left"
                  onClick={() => router.push(`/usuarios/${conversationInfo.client.id}`)}
                >
                  {conversationInfo.client.avatarUrl ? (
                    <img
                      className="avatar-image"
                      src={conversationInfo.client.avatarUrl}
                      alt={conversationInfo.client.name}
                    />
                  ) : (
                    <div className="avatar-fallback">{conversationInfo.client.name.slice(0, 2).toUpperCase()}</div>
                  )}
                  <div>
                    <p className="text-sm font-semibold">{conversationInfo.client.name}</p>
                    <p className="text-xs text-muted">{t("chat.clientLabel")}</p>
                  </div>
                </button>
              )}
              <span className="text-xs text-slate-500">{t("chat.profileHint")}</span>
            </div>
          ) : null}
          {proposalQuery.data ? (
            <div className="mb-6 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold">{proposalQuery.data.job.title}</p>
                  <p className="mt-1 text-xs text-muted">
                    {t("chat.proposalCurrent", {
                      value: formatCurrency(proposalQuery.data.bidAmount),
                    })}
                  </p>
                </div>
                <span
                  className={
                    proposalQuery.data.status === "ACCEPTED"
                      ? "chip-success"
                      : proposalQuery.data.status === "REJECTED" || proposalQuery.data.status === "CANCELLED"
                        ? "chip-danger"
                        : "chip-neutral"
                  }
                >
                  {proposalQuery.data.status}
                </span>
              </div>
              {proposalQuery.data.status === "PENDING" && user?.role === "CLIENT" ? (
                <div className="mt-4 flex flex-wrap gap-2">
                  <button
                    className="btn-success"
                    disabled={updateStatusMutation.isPending}
                    onClick={() => updateStatusMutation.mutate("ACCEPTED")}
                  >
                    {t("chat.proposalAccept", {
                      value: formatCurrency(proposalQuery.data.bidAmount),
                    })}
                  </button>
                  <button
                    className="btn-danger"
                    disabled={updateStatusMutation.isPending}
                    onClick={() => updateStatusMutation.mutate("REJECTED")}
                  >
                    {t("chat.proposalReject")}
                  </button>
                </div>
              ) : null}

              {proposalQuery.data.status === "PENDING" && user?.role === "FREELANCER" ? (
                <div className="mt-4">
                  <button
                    className="btn-outline"
                    type="button"
                    onClick={() => {
                      setEditBidOpen((prev) => !prev);
                      setBidInput(String(proposalQuery.data?.bidAmount ?? ""));
                    }}
                  >
                    {t("chat.proposalEdit")}
                  </button>
                  {editBidOpen ? (
                    <form
                   
                      className="mt-3 flex flex-wrap items-end gap-3"
                      onSubmit={(event) => {
                        event.preventDefault();
                        const nextValue = Number(bidInput);
                        if (!Number.isFinite(nextValue) || nextValue <= 0) return;
                        updateBidMutation.mutate(nextValue);
                      }}
                    >
                      <label className="form-label" >
                        {t("chat.proposalNewValue")}
                        <input
                          className="input"
                          type="number"
                          value={bidInput}
                          onChange={(event) => setBidInput(event.target.value)}
                          min={1}
                          step={1}
                        />
                      </label >
                      <button  className="btn-success" type="submit" disabled={updateBidMutation.isPending}>
                        {updateBidMutation.isPending ? t("chat.proposalSaving") : t("chat.proposalSave")}
                      </button>
                    </form>
                  ) : null}
                </div>
              ) : null}
            </div>
          ) : null}

          {messagesQuery.isLoading ? (
            <div className="loader-wrap">
              <div className="loader"></div>
            </div>
          ) : orderedMessages.length === 0 ? (
            <p className="text-sm text-muted">{t("chat.empty")}</p>
          ) : (
            <div className="chat-thread" >
              {sortedMessages.map((item) => (
                <div 
                  key={item.id}
                  className={`rounded-2xl px-4 py-3 text-sm ${
                    item.senderId === user?.id
                      ? "chat-message chat-message-own chat-message-right"
                      : "chat-message chat-message-other chat-message-left"
                  }`}
                >
                  <p  className={`text-xs font-semibold ${item.senderId === user?.id ? "text-white" : "text-slate-900"}`}>
                    {item.senderId === user?.id
                      ? t("chat.you")
                      : participantNames[item.senderId] ?? t("chat.other")}
                  </p>
                  <p  className="whitespace-pre-line">{item.body}</p>
                  <p  className={`mt-2 text-xs ${item.senderId === user?.id ? "text-white" : "text-slate-900"}`}>
                    {new Date(item.createdAt).toLocaleString()}
                  </p>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>
          )}

          <form className="mt-6 grid gap-3" id="ttx" onSubmit={handleSend}>
            <textarea id="chatEnv"
              className="textarea"
              placeholder={t("chat.placeholder")}
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              onKeyDown={handleKeyDown}
            />
            <button className="btn-primary" disabled={sendMutation.isPending}>
              {sendMutation.isPending ? t("chat.sending") : t("chat.send")}
            </button>
          </form>
        </div>
      </section>
    </main>
  );
}
