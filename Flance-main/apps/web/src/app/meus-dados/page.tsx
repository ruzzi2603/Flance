"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useI18n } from "../../i18n/useI18n";
import { getCurrentUser } from "../../services/api";
import { deleteMyAccount, exportMyData } from "../../services/privacy";
import { useAuthStore } from "../../store/useAuthStore";

const CONFIRM_WORD = "EXCLUIR";
const alertClass = "rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700";
const okClass = "rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-700";

function getErrorMessage(error: unknown, fallback: string): string {
  const message = (error as { response?: { data?: { message?: string | string[] } } } | null)?.response?.data?.message;
  if (Array.isArray(message)) return message[0] || fallback;
  return typeof message === "string" && message ? message : fallback;
}

export default function MyDataPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { setUser } = useAuthStore();
  const { t } = useI18n();

  const meQuery = useQuery({ queryKey: ["auth", "me"], queryFn: getCurrentUser, retry: false });
  const me = meQuery.data?.data ?? null;

  useEffect(() => {
    if (!meQuery.isLoading && !me) router.replace("/login?next=%2Fmeus-dados");
  }, [meQuery.isLoading, me, router]);

  const [exportPassword, setExportPassword] = useState("");
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const [exportDone, setExportDone] = useState(false);

  const [deletePassword, setDeletePassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  async function handleExport(event: FormEvent) {
    event.preventDefault();
    setExportError(null);
    setExportDone(false);
    setExporting(true);
    try {
      const data = await exportMyData(exportPassword);
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `flance-meus-dados-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      setExportPassword("");
      setExportDone(true);
    } catch (error) {
      setExportError(getErrorMessage(error, t("mydata.export.error")));
    } finally {
      setExporting(false);
    }
  }

  async function handleDelete(event: FormEvent) {
    event.preventDefault();
    setDeleteError(null);
    if (confirmation !== CONFIRM_WORD) return setDeleteError(t("mydata.delete.confirmInvalid", { word: CONFIRM_WORD }));
    if (!window.confirm(t("mydata.delete.finalConfirm"))) return;

    setDeleting(true);
    try {
      await deleteMyAccount(deletePassword, confirmation);
      // O servidor já limpou os cookies de sessão
      setUser(null);
      queryClient.clear();
      window.location.href = "/";
    } catch (error) {
      setDeleteError(getErrorMessage(error, t("mydata.delete.error")));
      setDeleting(false);
    }
  }

  if (meQuery.isLoading || !me) {
    return (
      <main className="page-shell">
        <div className="loader-wrap">
          <div className="loader" />
        </div>
      </main>
    );
  }

  return (
    <main className="page-shell">
      <section className="section-shell">
        <div className="mx-auto w-full max-w-lg grid gap-6">
          <div>
            <h1 className="heading-lg">{t("mydata.title")}</h1>
            <p className="mt-2 text-sm text-slate-400">{t("mydata.subtitle")}</p>
            <p className="mt-2 text-xs text-slate-400">
              <Link className="text-sky-400 underline" href="/privacidade">
                {t("mydata.policy")}
              </Link>
            </p>
          </div>

          <form onSubmit={handleExport} className="card grid gap-3" noValidate>
            <h2 className="text-lg font-semibold text-white">{t("mydata.export.title")}</h2>
            <p className="text-sm text-slate-300">{t("mydata.export.desc")}</p>
            <label className="form-label">
              {t("mydata.password")}
              <input className="input" type="password" autoComplete="current-password" value={exportPassword} onChange={(e) => setExportPassword(e.target.value)} />
            </label>
            {exportError ? <div className={alertClass} role="alert">{exportError}</div> : null}
            {exportDone ? <div className={okClass}>{t("mydata.export.done")}</div> : null}
            <button className="btn-primary" type="submit" disabled={exporting || !exportPassword}>
              {exporting ? t("mydata.export.submitting") : t("mydata.export.submit")}
            </button>
          </form>

          <form onSubmit={handleDelete} className="card grid gap-3 border border-rose-500/40" noValidate>
            <h2 className="text-lg font-semibold text-white">{t("mydata.delete.title")}</h2>
            <p className="text-sm text-slate-300">{t("mydata.delete.desc")}</p>
            <ul className="list-disc space-y-1 pl-5 text-sm text-slate-300">
              <li>{t("mydata.delete.item1")}</li>
              <li>{t("mydata.delete.item2")}</li>
              <li>{t("mydata.delete.item3")}</li>
            </ul>
            <label className="form-label">
              {t("mydata.password")}
              <input className="input" type="password" autoComplete="current-password" value={deletePassword} onChange={(e) => setDeletePassword(e.target.value)} />
            </label>
            <label className="form-label">
              {t("mydata.delete.confirmLabel", { word: CONFIRM_WORD })}
              <input className="input" value={confirmation} onChange={(e) => setConfirmation(e.target.value)} autoComplete="off" />
            </label>
            {deleteError ? <div className={alertClass} role="alert">{deleteError}</div> : null}
            <button
              className="rounded-xl bg-rose-600 px-4 py-3 font-semibold text-white disabled:opacity-50"
              type="submit"
              disabled={deleting || !deletePassword || confirmation !== CONFIRM_WORD}
            >
              {deleting ? t("mydata.delete.submitting") : t("mydata.delete.submit")}
            </button>
          </form>
        </div>
      </section>
    </main>
  );
}
