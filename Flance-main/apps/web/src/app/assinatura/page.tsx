"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useI18n } from "../../i18n/useI18n";
import { getCurrentUser } from "../../services/api";
import {
  cancelRenewal,
  getMySubscription,
  getPendingActivation,
  reactivateRenewal,
  type GetMySubscriptionResponse,
} from "../../services/payments";

const fmtDate = (iso: string | null | undefined) =>
  iso ? new Date(iso).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" }) : "—";

export default function SubscriptionPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { t, formatCurrency } = useI18n();
  const [actionError, setActionError] = useState(false);

  const meQuery = useQuery({ queryKey: ["auth", "me"], queryFn: getCurrentUser, retry: false });
  const me = meQuery.data?.data ?? null;

  useEffect(() => {
    if (!meQuery.isLoading && !me) router.replace("/login?next=%2Fassinatura");
  }, [meQuery.isLoading, me, router]);

  const subQuery = useQuery({ queryKey: ["subscription", "me"], queryFn: getMySubscription, enabled: Boolean(me) });
  const pendingQuery = useQuery({ queryKey: ["payments", "pending-activation"], queryFn: getPendingActivation, enabled: Boolean(me) });

  const onSuccess = (data: GetMySubscriptionResponse) => {
    setActionError(false);
    queryClient.setQueryData(["subscription", "me"], data);
  };
  const cancelMutation = useMutation({ mutationFn: cancelRenewal, onSuccess, onError: () => setActionError(true) });
  const reactivateMutation = useMutation({ mutationFn: reactivateRenewal, onSuccess, onError: () => setActionError(true) });

  const data = subQuery.data;
  const billing = data?.billing;
  const sub = data?.subscription;
  const active = Boolean(data?.hasActiveSubscription && sub);

  function handleCancel() {
    if (window.confirm(t("sub.cancel.confirm", { date: fmtDate(sub?.expiresAt) }))) cancelMutation.mutate();
  }

  return (
    <main className="page-shell">
      <section className="section-shell">
        <div className="mx-auto w-full max-w-lg">
          <h1 className="heading-lg">{t("sub.title")}</h1>

          {subQuery.isLoading || meQuery.isLoading ? (
            <div className="loader-wrap">
              <div className="loader" />
            </div>
          ) : null}

          {pendingQuery.data ? (
            <div className="mt-6 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-800">
              <Link className="font-semibold underline" href="/checkout?step=code">
                {t("checkout.code.title")}
              </Link>
            </div>
          ) : null}

          {data && !active ? (
            <div className="card mt-6">
              <p className="text-slate-300">{t("sub.noPlan")}</p>
              <Link className="btn-primary mt-4 inline-flex" href="/planos">
                {t("sub.seePlans")}
              </Link>
            </div>
          ) : null}

          {data && active && sub ? (
            <div className="card mt-6 grid gap-4 text-sm text-slate-300">
              <dl className="grid grid-cols-2 gap-y-2">
                <dt>{t("sub.plan")}</dt>
                <dd className="text-right font-semibold text-white">{data.planConfig.name}</dd>
                <dt>{t("sub.status")}</dt>
                <dd className="text-right font-semibold text-white">
                  {billing?.cancelAtPeriodEnd ? t("sub.status.canceling") : t("sub.status.active")}
                </dd>
                <dt>{t("sub.validUntil")}</dt>
                <dd className="text-right font-semibold text-white">{fmtDate(sub.expiresAt)}</dd>
                <dt>{t("sub.monthly")}</dt>
                <dd className="text-right font-semibold text-white">{formatCurrency(billing?.recurringAmount ?? data.planConfig.price, "BRL")}</dd>
                {billing?.autoRenew ? (
                  <>
                    <dt>{t("sub.nextCharge")}</dt>
                    <dd className="text-right font-semibold text-white">{fmtDate(billing.nextDueDate ?? sub.expiresAt)}</dd>
                  </>
                ) : null}
              </dl>

              {billing?.openInvoice ? (
                <div className={`rounded-xl px-4 py-3 ${billing.openInvoice.overdue ? "bg-rose-50 text-rose-800" : "bg-sky-50 text-sky-900"}`}>
                  <p className="font-semibold">{t("sub.invoice.title")}</p>
                  <p>
                    {formatCurrency(billing.openInvoice.amount, "BRL")} ·{" "}
                    {billing.openInvoice.overdue
                      ? t("sub.invoice.overdue", { date: fmtDate(billing.openInvoice.dueDate) })
                      : t("sub.invoice.due", { date: fmtDate(billing.openInvoice.dueDate) })}
                  </p>
                  <Link className="btn-primary mt-3 inline-flex" href={`/checkout?paymentId=${billing.openInvoice.paymentId}`}>
                    {t("sub.invoice.pay")}
                  </Link>
                </div>
              ) : null}

              {billing?.autoRenew ? (
                <>
                  <p className="text-xs text-slate-400">{t("sub.autoNote", { day: billing.billingAnchorDay })}</p>
                  {!billing.recurringScheduled ? <p className="text-xs text-amber-300">{t("sub.scheduling")}</p> : null}
                </>
              ) : (
                <p className="text-amber-300">{t("sub.canceledNote", { date: fmtDate(sub.expiresAt) })}</p>
              )}

              {actionError ? <div className="rounded-xl bg-rose-50 px-4 py-3 text-rose-700">{t("sub.error")}</div> : null}

              {billing?.autoRenew ? (
                <button className="btn-outline" type="button" onClick={handleCancel} disabled={cancelMutation.isPending}>
                  {t("sub.cancel")}
                </button>
              ) : (
                <button className="btn-primary" type="button" onClick={() => reactivateMutation.mutate()} disabled={reactivateMutation.isPending}>
                  {t("sub.reactivate")}
                </button>
              )}
            </div>
          ) : null}

          {data?.contract ? (
            <div className="card mt-4 text-sm text-slate-300">
              <p className="font-semibold text-white">{t("sub.contract")}</p>
              <p>{t("sub.contract.accepted", { date: fmtDate(data.contract.acceptedAt), version: data.contract.version })}</p>
              <Link className="mt-2 inline-block text-sky-400 underline" href="/contrato?view=accepted">
                {t("sub.contract.view")}
              </Link>
            </div>
          ) : null}
        </div>
      </section>
    </main>
  );
}
