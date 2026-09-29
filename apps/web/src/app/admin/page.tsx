"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import { useAuth } from "../../hooks/useAuth";
import { useI18n } from "../../i18n/useI18n";
import {
  alertAdminUser,
  banAdminUser,
  deleteAdminUser,
  listAdminAds,
  listAdminAudit,
  listAdminUsers,
  moderateAdminAd,
  unbanAdminUser,
} from "../../services/admin";

type AdminTab = "users" | "ads" | "audit";
type PendingAction = {
  type: "alert" | "ban" | "unban" | "delete" | "ad";
  id: string;
  label: string;
  active?: boolean;
};

function formatDate(date: string) {
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(date));
}

export default function AdminPage() {
  const { user, isLoading } = useAuth();
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<AdminTab>("users");
  const [search, setSearch] = useState("");
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(null);
  const [reason, setReason] = useState("");
  const [actionError, setActionError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const isAdmin = user?.role === "ADMIN";

  const usersQuery = useQuery({
    queryKey: ["admin", "users", search],
    queryFn: () => listAdminUsers(search),
    enabled: isAdmin && tab === "users",
  });
  const adsQuery = useQuery({
    queryKey: ["admin", "ads", search],
    queryFn: () => listAdminAds(search),
    enabled: isAdmin && tab === "ads",
  });
  const auditQuery = useQuery({
    queryKey: ["admin", "audit"],
    queryFn: listAdminAudit,
    enabled: isAdmin && tab === "audit",
  });

  const actionMutation = useMutation({
    mutationFn: async () => {
      if (!pendingAction) throw new Error("No moderation action selected");
      switch (pendingAction.type) {
        case "alert": return alertAdminUser(pendingAction.id, reason.trim());
        case "ban": return banAdminUser(pendingAction.id, reason.trim());
        case "unban": return unbanAdminUser(pendingAction.id, reason.trim());
        case "delete": return deleteAdminUser(pendingAction.id, reason.trim());
        case "ad": return moderateAdminAd(pendingAction.id, Boolean(pendingAction.active), reason.trim());
      }
    },
    onSuccess: async (result) => {
      const notificationStatus = "notificationStatus" in result ? result.notificationStatus : "FAILED";
      setNotice(notificationStatus === "SENT" ? t("admin.noticeSent") : t("admin.noticeFailed"));
      setActionError(null);
      setPendingAction(null);
      setReason("");
      await queryClient.invalidateQueries({ queryKey: ["admin"] });
    },
    onError: (error) => {
      const responseData = axios.isAxiosError(error) ? error.response?.data as { message?: string | string[] } | undefined : undefined;
      const message = Array.isArray(responseData?.message) ? responseData.message[0] : responseData?.message;
      setActionError(message || t("admin.actionError"));
    },
  });

  const openAction = (action: PendingAction) => {
    setNotice(null);
    setActionError(null);
    setReason("");
    setPendingAction(action);
  };

  if (isLoading) {
    return <main className="page-shell"><section className="section-shell"><div className="card"><div className="loader-wrap"><div className="loader" /></div></div></section></main>;
  }

  if (!isAdmin) {
    return (
      <main className="page-shell">
        <section className="section-shell admin-page">
          <div className="admin-empty-state">
            <h1 className="heading-lg">{t("admin.deniedTitle")}</h1>
            <p className="mt-2 text-muted">{t("admin.deniedDescription")}</p>
          </div>
        </section>
      </main>
    );
  }

  const activeLoading = tab === "users" ? usersQuery.isLoading : tab === "ads" ? adsQuery.isLoading : auditQuery.isLoading;
  const activeError = tab === "users" ? usersQuery.isError : tab === "ads" ? adsQuery.isError : auditQuery.isError;
  const confirmTitle = pendingAction?.type === "ad"
    ? t("admin.confirm.ad", { action: t(pendingAction.active ? "admin.restoreAd" : "admin.removeAd").toLowerCase() })
    : pendingAction
      ? t(`admin.confirm.${pendingAction.type}`)
      : "";

  return (
    <main className="page-shell">
      <section className="section-shell admin-page">
        <header className="admin-header">
          <div>
            <p className="admin-eyebrow">{t("admin.eyebrow")}</p>
            <h1 className="heading-xl">{t("admin.title")}</h1>
            <p className="mt-2 text-muted">{t("admin.subtitle")}</p>
          </div>
          <span className="admin-session-label">{user?.name || user?.email}</span>
        </header>

        <div className="admin-toolbar">
          <div className="admin-tabs" role="tablist" aria-label={t("admin.title")}>
            {(["users", "ads", "audit"] as AdminTab[]).map((item) => (
              <button key={item} type="button" role="tab" aria-selected={tab === item} className={tab === item ? "is-active" : ""} onClick={() => setTab(item)}>
                {t(`admin.tab.${item}`)}
              </button>
            ))}
          </div>
          {tab !== "audit" ? (
            <input className="admin-search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder={t("admin.search")} />
          ) : null}
        </div>

        {notice ? <div className="admin-notice" role="status">{notice}</div> : null}

        {activeLoading ? (
          <div className="card"><div className="loader-wrap"><div className="loader" /></div></div>
        ) : activeError ? (
          <div className="admin-empty-state"><p>{t("admin.loadError")}</p></div>
        ) : tab === "users" ? (
          <div className="admin-table-wrap">
            <div className="admin-table-summary">{t("admin.totalUsers", { count: usersQuery.data?.total ?? 0 })}</div>
            <table className="admin-table">
              <thead><tr><th>{t("admin.user")}</th><th>{t("admin.email")}</th><th>{t("admin.createdAt")}</th><th>{t("admin.status")}</th><th>{t("admin.actions")}</th></tr></thead>
              <tbody>
                {usersQuery.data?.items.map((account) => (
                  <tr key={account.id}>
                    <td><strong>{account.name}</strong><small>{account.role}{account.companyName ? ` · ${account.companyName}` : ""}</small></td>
                    <td>{account.email}</td>
                    <td>{formatDate(account.createdAt)}</td>
                    <td><span className={`admin-status ${account.bannedAt ? "is-banned" : "is-active"}`}>{account.bannedAt ? t("admin.banned") : t("admin.active")}</span></td>
                    <td><div className="admin-row-actions">
                      {account.role !== "ADMIN" ? <>
                        <button type="button" onClick={() => openAction({ type: "alert", id: account.id, label: account.name })}>{t("admin.alert")}</button>
                        {account.bannedAt
                          ? <button type="button" onClick={() => openAction({ type: "unban", id: account.id, label: account.name })}>{t("admin.unban")}</button>
                          : <button type="button" onClick={() => openAction({ type: "ban", id: account.id, label: account.name })}>{t("admin.ban")}</button>}
                        <button className="is-danger" type="button" onClick={() => openAction({ type: "delete", id: account.id, label: account.name })}>{t("admin.delete")}</button>
                      </> : <span className="text-muted">{t("admin.protectedAdmin")}</span>}
                    </div></td>
                  </tr>
                ))}
                {!usersQuery.data?.items.length ? <tr><td colSpan={5}>{t("admin.noUsers")}</td></tr> : null}
              </tbody>
            </table>
          </div>
        ) : tab === "ads" ? (
          <div className="admin-table-wrap">
            <div className="admin-table-summary">{t("admin.totalAds", { count: adsQuery.data?.total ?? 0 })}</div>
            <table className="admin-table">
              <thead><tr><th>{t("admin.ad")}</th><th>{t("admin.publisher")}</th><th>{t("admin.createdAt")}</th><th>{t("admin.status")}</th><th>{t("admin.actions")}</th></tr></thead>
              <tbody>
                {adsQuery.data?.items.map((ad) => (
                  <tr key={ad.id}>
                    <td><strong>{ad.companyName}</strong><small>{ad.companyLocation || ad.companyDescription || "-"}</small></td>
                    <td>{ad.name}<small>{ad.email}</small></td>
                    <td>{formatDate(ad.createdAt)}</td>
                    <td><span className={`admin-status ${ad.companyEnabled ? "is-active" : "is-banned"}`}>{ad.companyEnabled ? t("admin.active") : t("admin.removed")}</span></td>
                    <td><div className="admin-row-actions">
                      <button type="button" onClick={() => openAction({ type: "alert", id: ad.id, label: ad.name })}>{t("admin.alert")}</button>
                      <button className={ad.companyEnabled ? "is-danger" : ""} type="button" onClick={() => openAction({ type: "ad", id: ad.id, label: ad.companyName, active: !ad.companyEnabled })}>{ad.companyEnabled ? t("admin.removeAd") : t("admin.restoreAd")}</button>
                    </div></td>
                  </tr>
                ))}
                {!adsQuery.data?.items.length ? <tr><td colSpan={5}>{t("admin.noAds")}</td></tr> : null}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead><tr><th>{t("admin.createdAt")}</th><th>{t("admin.event")}</th><th>{t("admin.target")}</th><th>{t("admin.reason")}</th><th>{t("admin.emailStatus")}</th></tr></thead>
              <tbody>
                {auditQuery.data?.map((event) => (
                  <tr key={event.id}>
                    <td>{formatDate(event.createdAt)}</td>
                    <td>{t(`admin.event.${event.action}`)}</td>
                    <td>{event.targetName}<small>{event.targetEmail}</small></td>
                    <td className="admin-audit-reason">{event.reason}</td>
                    <td><span className={`admin-status ${event.notificationStatus === "SENT" ? "is-active" : "is-banned"}`}>{t(`admin.notification.${event.notificationStatus}`)}</span></td>
                  </tr>
                ))}
                {!auditQuery.data?.length ? <tr><td colSpan={5}>{t("admin.noAudit")}</td></tr> : null}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {pendingAction ? (
        <div className="admin-dialog-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setPendingAction(null); }}>
          <section className="admin-dialog" role="dialog" aria-modal="true" aria-labelledby="admin-dialog-title">
            <p className="admin-eyebrow">{t("admin.confirmEyebrow")}</p>
            <h2 className="heading-lg" id="admin-dialog-title">{confirmTitle}</h2>
            <p className="mt-2 text-sm text-muted">{t("admin.actionTarget", { target: pendingAction.label })}</p>
            {pendingAction.type === "delete" ? <p className="admin-delete-warning">{t("admin.deleteWarning")}</p> : null}
            <label className="admin-reason-label">
              {t("admin.reasonRequired")}
              <textarea value={reason} onChange={(event) => setReason(event.target.value)} minLength={10} maxLength={1000} rows={4} autoFocus />
              <small>{reason.trim().length}/1000</small>
            </label>
            {actionError ? <p className="admin-action-error" role="alert">{actionError}</p> : null}
            <div className="admin-dialog-actions">
              <button className="btn-outline" type="button" onClick={() => setPendingAction(null)} disabled={actionMutation.isPending}>{t("admin.cancel")}</button>
              <button className={pendingAction.type === "delete" || pendingAction.type === "ban" || (pendingAction.type === "ad" && !pendingAction.active) ? "btn-danger" : "btn-primary"} type="button" disabled={reason.trim().length < 10 || actionMutation.isPending} onClick={() => actionMutation.mutate()}>
                {actionMutation.isPending ? t("admin.processing") : t("admin.confirmAction")}
              </button>
            </div>
          </section>
        </div>
      ) : null}
    </main>
  );
}