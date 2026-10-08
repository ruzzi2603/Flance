"use client";

import { Suspense, useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { CreatePaymentResponse, PaymentQuote, SubscriptionContract } from "@flance/types";
import { useI18n } from "../../i18n/useI18n";
import { getCurrentUser } from "../../services/api";
import {
  activateSubscription,
  createPayment,
  getPayment,
  getPaymentQuote,
  getPendingActivation,
  getSubscriptionContract,
  resendPaymentActivationCode,
} from "../../services/payments";
import { useAuthStore } from "../../store/useAuthStore";

type PaidPlanKey = "PROFESSIONAL" | "PROFESSIONAL_PLUS";
type Step = "loading" | "form" | "pix" | "expired" | "code" | "done" | "renewed";

const POLL_INTERVAL_MS = 5_000;
const RESEND_COOLDOWN_SECONDS = 60;

const parsePaidPlan = (value: string | null | undefined): PaidPlanKey | null => {
  const upper = value?.trim().toUpperCase();
  return upper === "PROFESSIONAL" || upper === "PROFESSIONAL_PLUS" ? upper : null;
};

const fmtDate = (iso: string) => new Date(iso).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });

function maskCpf(value: string): string {
  return value
    .replace(/\D/g, "")
    .slice(0, 11)
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d{1,2})$/, "$1-$2");
}

function getErrorMessage(error: unknown, fallback: string): string {
  const message = (error as { response?: { data?: { message?: string | string[] } } } | null)?.response?.data?.message;
  if (Array.isArray(message)) return message[0] || fallback;
  return typeof message === "string" && message ? message : fallback;
}

const alertClass = "rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700";
const okClass = "rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-700";

function CheckoutInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const { setUser } = useAuthStore();
  const { t, formatCurrency } = useI18n();

  // Mesma query key do useAuth: compartilha cache e evita corrida entre "carregou" e "store sincronizada"
  const meQuery = useQuery({ queryKey: ["auth", "me"], queryFn: getCurrentUser, retry: false });
  const me = meQuery.data?.data ?? null;

  const [step, setStep] = useState<Step>("loading");
  const [planKey, setPlanKey] = useState<PaidPlanKey | null>(parsePaidPlan(searchParams.get("plan")));
  const [fatalError, setFatalError] = useState<string | null>(null);

  const [quote, setQuote] = useState<PaymentQuote | null>(null);
  const [contract, setContract] = useState<SubscriptionContract | null>(null);
  const [contractError, setContractError] = useState(false);
  const [isContractOpen, setIsContractOpen] = useState(false);
  const [accepted, setAccepted] = useState(false);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const activationEmail = me?.email || email;
  const [cpf, setCpf] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  const [payment, setPayment] = useState<CreatePaymentResponse | null>(null);
  const [paymentId, setPaymentId] = useState<string | null>(null);
  const [copyState, setCopyState] = useState<"idle" | "copied" | "error">("idle");

  const [code, setCode] = useState("");
  const [codeError, setCodeError] = useState<string | null>(null);
  const [codeNotice, setCodeNotice] = useState<string | null>(null);
  const [isActivating, setIsActivating] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);

  const initialized = useRef(false);
  // Mesma chave em tentativas repetidas (duplo clique / retry) => o servidor não cria duas cobranças
  const idempotencyKey = useRef<string>(crypto.randomUUID());
  const isRecurring = payment?.kind === "RECURRING";

  useEffect(() => {
    if (!me) return;
    setName((current) => current || me.name || "");
    setEmail((current) => current || me.email || "");
  }, [me]);

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setTimeout(() => setResendCooldown((seconds) => seconds - 1), 1000);
    return () => clearTimeout(timer);
  }, [resendCooldown]);

  // Na etapa do formulário: simulação do valor + texto do contrato
  useEffect(() => {
    if (step !== "form" || !planKey) return;
    let cancelled = false;
    setContractError(false);
    Promise.all([getPaymentQuote(planKey), getSubscriptionContract()])
      .then(([q, c]) => {
        if (cancelled) return;
        setQuote(q);
        setContract(c);
      })
      .catch(() => !cancelled && setContractError(true));
    return () => {
      cancelled = true;
    };
  }, [step, planKey]);

  /**
   * Etapa inicial a partir da URL:
   *  ?paymentId=  retoma um pagamento (1º Pix ou mensalidade)
   *  ?step=code   veio do e-mail de ativação
   *  ?plan=       novo checkout
   */
  useEffect(() => {
    if (meQuery.isLoading || initialized.current) return;

    if (!me) {
      router.replace(`/login?next=${encodeURIComponent(`/checkout?${searchParams.toString()}`)}`);
      return;
    }
    initialized.current = true;

    (async () => {
      try {
        const paymentIdParam = searchParams.get("paymentId");
        if (paymentIdParam) {
          const existing = await getPayment(paymentIdParam);
          setPaymentId(existing.paymentId);
          setPlanKey(parsePaidPlan(existing.plan));
          setPayment(existing);

          if (existing.status === "PENDING" || (existing.kind === "RECURRING" && existing.status === "EXPIRED")) {
            setStep("pix");
          } else if (existing.status === "PAID") {
            if (existing.kind === "RECURRING") {
              setStep("renewed");
            } else {
              const pending = await getPendingActivation();
              if (pending?.paymentId === existing.paymentId) setStep("code");
              else router.replace("/assinatura");
            }
          } else {
            setStep("expired");
          }
          return;
        }

        if (searchParams.get("step") === "code") {
          const pending = await getPendingActivation();
          if (!pending) {
            router.replace("/assinatura");
            return;
          }
          setPaymentId(pending.paymentId);
          setPlanKey(parsePaidPlan(pending.plan));
          setStep("code");
          return;
        }

        if (parsePaidPlan(searchParams.get("plan"))) setStep("form");
        else router.replace("/planos");
      } catch (error) {
        setFatalError(getErrorMessage(error, t("checkout.loadError")));
      }
    })();
  }, [meQuery.isLoading, me, router, searchParams, t]);

  // Polling do Pix (o webhook é o caminho principal; isto cobre atrasos)
  useEffect(() => {
    if (step !== "pix" || !paymentId) return;
    const interval = setInterval(async () => {
      try {
        const current = await getPayment(paymentId);
        if (current.status === "PAID") {
          setPayment(current);
          if (current.kind === "RECURRING") {
            setStep("renewed");
          } else {
            setResendCooldown(RESEND_COOLDOWN_SECONDS);
            setStep("code");
          }
        } else if (current.status !== "PENDING" && !(current.kind === "RECURRING" && current.status === "EXPIRED")) {
          setStep("expired");
        }
      } catch {
        // falha transitória de rede: tenta de novo no próximo ciclo
      }
    }, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [step, paymentId]);

  // Redireciona depois de concluir
  useEffect(() => {
    if (step !== "done" && step !== "renewed") return;
    const timer = setTimeout(() => {
      if (step === "renewed") return router.replace("/assinatura");
      const fresh = queryClient.getQueryData<{ data?: { id: string; companyName?: string } }>(["auth", "me"])?.data;
      router.replace(fresh?.companyName ? `/empresas/${fresh.id}` : "/profile?edit=company");
    }, 2500);
    return () => clearTimeout(timer);
  }, [step, queryClient, router]);

  const handleCreatePayment = useCallback(
    async (event: FormEvent) => {
      event.preventDefault();
      setFormError(null);
      if (!planKey || !contract) return;

      if (!accepted) return setFormError(t("checkout.contract.required"));
      if (name.trim().split(/\s+/).length < 2) return setFormError(t("checkout.form.nameRequired"));
      if (!/^\S+@\S+\.\S+$/.test(email.trim())) return setFormError(t("checkout.form.emailRequired"));
      if (cpf.replace(/\D/g, "").length !== 11) return setFormError(t("checkout.form.cpfInvalid"));

      setIsCreating(true);
      try {
        // O valor NUNCA é enviado: o servidor calcula. O aceite vai com versão + hash do texto exibido.
        const created = await createPayment(
          {
            plan: planKey,
            name: name.trim(),
            email: email.trim(),
            cpf: cpf.replace(/\D/g, ""),
            acceptContract: true,
            contractVersion: contract.version,
            contractHash: contract.hash,
          },
          idempotencyKey.current,
        );
        setPayment(created);
        setPaymentId(created.paymentId);
        setStep("pix");
        router.replace(`/checkout?paymentId=${created.paymentId}`); // recarregar não perde o QR Code
      } catch (error) {
        setFormError(getErrorMessage(error, t("checkout.form.error")));
      } finally {
        setIsCreating(false);
      }
    },
    [planKey, contract, accepted, name, email, cpf, router, t],
  );

  async function handleCopyPix() {
    if (!payment?.pixCopyPaste) return;
    try {
      await navigator.clipboard.writeText(payment.pixCopyPaste);
      setCopyState("copied");
    } catch {
      setCopyState("error");
    }
    setTimeout(() => setCopyState("idle"), 3000);
  }

  async function handleActivate(event: FormEvent) {
    event.preventDefault();
    setCodeError(null);
    setCodeNotice(null);
    if (!paymentId) return;
    if (!/^\d{6}$/.test(code)) return setCodeError(t("checkout.code.invalid"));

    setIsActivating(true);
    try {
      await activateSubscription({ paymentId, code });
      const fresh = await getCurrentUser(); // planTier / companyEnabled mudaram no servidor
      queryClient.setQueryData(["auth", "me"], fresh);
      setUser(fresh.data);
      setStep("done");
    } catch (error) {
      setCodeError(getErrorMessage(error, t("checkout.code.error")));
    } finally {
      setIsActivating(false);
    }
  }

  async function handleResend() {
    if (!paymentId || resendCooldown > 0) return;
    setCodeError(null);
    setCodeNotice(null);
    setIsResending(true);
    try {
      const result = await resendPaymentActivationCode(paymentId);
      if (!result.sent) return setCodeError(t("checkout.code.resendError"));
      setCode("");
      setCodeNotice(t("checkout.code.resent"));
      setResendCooldown(RESEND_COOLDOWN_SECONDS);
    } catch (error) {
      setCodeError(getErrorMessage(error, t("checkout.code.resendError")));
    } finally {
      setIsResending(false);
    }
  }

  function handleRetryAfterExpired() {
    idempotencyKey.current = crypto.randomUUID();
    setPayment(null);
    setPaymentId(null);
    setAccepted(false);
    setStep("form");
    router.replace(`/checkout?plan=${planKey ?? "PROFESSIONAL"}`);
  }

  const showSteps = step !== "loading" && !fatalError && !isRecurring && step !== "renewed";
  const stepIndex = step === "form" ? 0 : step === "pix" || step === "expired" ? 1 : 2;
  const stepLabels = [t("checkout.step.data"), t("checkout.step.pix"), t("checkout.step.activate")];

  return (
    <main className="page-shell">
      <section className="section-shell">
        <div className="mx-auto w-full max-w-lg">
          <h1 className="heading-lg">{t("checkout.title")}</h1>
          <p className="mt-2 text-sm text-slate-400">{t("checkout.subtitle")}</p>

          {showSteps ? (
            <ol className="mt-6 flex items-center gap-2 text-xs text-slate-400">
              {stepLabels.map((label, index) => {
                const finished = index < stepIndex || step === "done";
                return (
                  <li key={label} className={`flex items-center gap-2 ${index <= stepIndex || step === "done" ? "text-white" : ""}`}>
                    <span
                      className={`flex h-6 w-6 items-center justify-center rounded-full border text-[11px] ${
                        finished ? "border-emerald-500 bg-emerald-500 text-white" : index === stepIndex ? "border-[#FF4103] text-white" : "border-slate-600"
                      }`}
                    >
                      {finished ? "✓" : index + 1}
                    </span>
                    {label}
                    {index < stepLabels.length - 1 ? <span className="mx-1 h-px w-6 bg-slate-600" /> : null}
                  </li>
                );
              })}
            </ol>
          ) : null}

          <div className="card checkout-card mt-6" aria-live="polite">
            {fatalError ? (
              <div>
                <div className={alertClass}>{fatalError}</div>
                <Link className="btn-outline mt-4 inline-flex" href="/planos">
                  {t("checkout.back")}
                </Link>
              </div>
            ) : null}

            {!fatalError && step === "loading" ? (
              <div className="loader-wrap">
                <div className="loader" />
              </div>
            ) : null}

            {!fatalError && step === "form" && planKey ? (
              <form onSubmit={handleCreatePayment} className="checkout-form grid gap-5" noValidate>
                {contractError ? <div className={alertClass}>{t("checkout.contract.loadError")}</div> : null}

                {quote ? (
                  <div className="checkout-summary">
                    <p className="checkout-summary-title">{t("checkout.plan", { plan: quote.planName })}</p>
                    <p className="checkout-summary-price">
                      {t("checkout.quote.today")}:{" "}
                      <strong>{formatCurrency(quote.initialAmount, "BRL")}</strong>
                    </p>
                    <p className="checkout-summary-detail">{t("checkout.quote.covers", { date: fmtDate(quote.firstRenewalDate) })}</p>
                    <p>
                      {t("checkout.quote.then", {
                        value: formatCurrency(quote.recurringAmount, "BRL"),
                        day: quote.billingAnchorDay,
                      })}
                    </p>
                    <p className="checkout-summary-note">{t("checkout.quote.pixNote")}</p>
                  </div>
                ) : null}

                <label className="checkout-field">
                  {t("checkout.form.name")}
                  <input className="checkout-input" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" required />
                </label>
                <label className="checkout-field">
                  {t("checkout.form.email")}
                  <input className="checkout-input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" required />
                </label>
                <label className="checkout-field">
                  {t("checkout.form.cpf")}
                  <input
                    className="input"
                    inputMode="numeric"
                    placeholder="000.000.000-00"
                    value={cpf}
                    onChange={(e) => setCpf(maskCpf(e.target.value))}
                    autoComplete="off"
                    required
                  />
                  <span className="checkout-hint">{t("checkout.form.cpfHint")}</span>
                </label>

                {contract ? (
                  <div className="checkout-contract-area">
                    <button
                      className="checkout-contract-toggle"
                      type="button"
                      aria-expanded={isContractOpen}
                      aria-controls="subscription-contract-card"
                      onClick={() => setIsContractOpen((open) => !open)}
                    >
                      <span>{isContractOpen ? t("checkout.contract.hide") : t("checkout.contract.show")}</span>
                      <span className="checkout-contract-chevron" aria-hidden="true">{isContractOpen ? "-" : "+"}</span>
                    </button>
                    {isContractOpen ? (
                      <div className="checkout-contract-card" id="subscription-contract-card">
                        <div className="checkout-contract-heading">
                          <span>{t("checkout.contract.title")}</span>
                          <a href="/contrato" target="_blank" rel="noopener noreferrer">{t("checkout.contract.open")}</a>
                        </div>
                        <div className="checkout-contract" tabIndex={0}>
                          {contract.sections.map((section) => (
                            <section key={section.id} className="mb-3">
                              <h3>{section.title}</h3>
                              {section.paragraphs.map((paragraph, index) => <p key={index}>{paragraph}</p>)}
                            </section>
                          ))}
                        </div>
                      </div>
                    ) : null}
                    <p className="checkout-legal-links">
                      <a href="/pagamentos" target="_blank" rel="noopener noreferrer">{t("checkout.legal.payments")}</a>
                      {" · "}
                      <a href="/privacidade" target="_blank" rel="noopener noreferrer">{t("checkout.legal.privacy")}</a>
                    </p>
                    <label className="checkout-accept">
                      <input type="checkbox" checked={accepted} onChange={(e) => setAccepted(e.target.checked)} />
                      <span>{t("checkout.contract.accept", { version: contract.version })}</span>
                    </label>
                  </div>
                ) : null}

                {formError ? (
                  <div className={alertClass} role="alert">
                    {formError}
                  </div>
                ) : null}

                <button className="btn-primary checkout-submit" type="submit" disabled={isCreating || !contract || !accepted}>
                  {isCreating ? t("checkout.form.submitting") : t("checkout.form.submit")}
                </button>
              </form>
            ) : null}

            {!fatalError && step === "pix" && payment ? (
              <div className="checkout-stage grid gap-4">
                <div>
                  <h2 className="checkout-stage-title">{t("checkout.pix.title")}</h2>
                  <p className="checkout-stage-copy">{t("checkout.pix.instructions")}</p>
                </div>
                <div>
                  <p className="checkout-stage-amount">{formatCurrency(payment.amount, "BRL")}</p>
                  {isRecurring && payment.dueDate ? (
                    <p className="checkout-stage-copy">{t("checkout.pix.due", { date: fmtDate(payment.dueDate) })}</p>
                  ) : null}
                </div>

                {payment.pixQrCode ? (
                  <div className="checkout-qr mx-auto">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img className="h-56 w-56" src={`data:image/png;base64,${payment.pixQrCode}`} alt={t("checkout.pix.qrAlt")} />
                  </div>
                ) : null}

                <label className="checkout-field">
                  {t("checkout.pix.copyLabel")}
                  <textarea className="checkout-input checkout-pix-code font-mono text-xs" rows={4} readOnly value={payment.pixCopyPaste} onFocus={(e) => e.currentTarget.select()} />
                </label>
                <button className="btn-outline" type="button" onClick={handleCopyPix}>
                  {copyState === "copied" ? t("checkout.pix.copied") : copyState === "error" ? t("checkout.pix.copyError") : t("checkout.pix.copy")}
                </button>

                <p className="checkout-stage-copy flex items-center gap-2">
                  <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-amber-400" />
                  {t("checkout.pix.waiting")}
                </p>
              </div>
            ) : null}

            {!fatalError && step === "expired" ? (
              <div className="checkout-stage grid gap-3">
                <h2 className="checkout-stage-title">{t("checkout.expired.title")}</h2>
                <p className="checkout-stage-copy">{t("checkout.expired.desc")}</p>
                <button className="btn-primary" type="button" onClick={handleRetryAfterExpired}>
                  {t("checkout.expired.retry")}
                </button>
              </div>
            ) : null}

            {!fatalError && step === "code" ? (
              <form onSubmit={handleActivate} className="checkout-form grid gap-5" noValidate>
                <div className={okClass}>{t("checkout.pix.paid", { email: activationEmail })}</div>
                <div>
                  <h2 className="checkout-stage-title">{t("checkout.code.title")}</h2>
                  <p className="checkout-stage-copy">{t("checkout.code.desc", { email: activationEmail })}</p>
                  <div className="checkout-code-email">{activationEmail}</div>
                </div>
                <label className="checkout-field">
                  {t("checkout.code.label")}
                  <input
                    className="checkout-input text-center font-mono text-2xl tracking-[0.5em]"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    maxLength={6}
                    placeholder="000000"
                    value={code}
                    onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  />
                </label>
                {codeError ? (
                  <div className={alertClass} role="alert">
                    {codeError}
                  </div>
                ) : null}
                {codeNotice ? <div className={okClass}>{codeNotice}</div> : null}
                <button className="btn-primary" type="submit" disabled={isActivating || code.length !== 6}>
                  {isActivating ? t("checkout.code.submitting") : t("checkout.code.submit")}
                </button>
                <button className="btn-outline" type="button" onClick={handleResend} disabled={isResending || resendCooldown > 0}>
                  {resendCooldown > 0 ? t("checkout.code.resendIn", { seconds: resendCooldown }) : t("checkout.code.resend")}
                </button>
              </form>
            ) : null}

            {!fatalError && (step === "done" || step === "renewed") ? (
              <div className="checkout-stage checkout-complete grid gap-2 text-center">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500 text-2xl text-white">✓</div>
                <h2 className="checkout-stage-title">{step === "done" ? t("checkout.done.title") : t("checkout.renewed.title")}</h2>
                <p className="checkout-stage-copy">
                  {step === "done" ? t("checkout.done.desc") : t("checkout.renewed.desc")}
                </p>
              </div>
            ) : null}
          </div>
        </div>
      </section>
    </main>
  );
}

export default function CheckoutPage() {
  return (
    <Suspense fallback={null}>
      <CheckoutInner />
    </Suspense>
  );
}
