import { api } from "./api";
import type {
  ActivateSubscriptionDto,
  ActivateSubscriptionResponse,
  CreatePaymentDto,
  CreatePaymentResponse,
  PaymentQuote,
  PlanConfig,
  SubscriptionContract,
  SubscriptionEntity,
} from "@flance/types";

export interface GetMySubscriptionResponse {
  hasActiveSubscription: boolean;
  plan: "FREE" | "PROFESSIONAL" | "PROFESSIONAL_PLUS";
  planConfig: PlanConfig;
  subscription: (SubscriptionEntity & {
    daysRemaining: number;
    isExpiringSoon: boolean;
  }) | null;
  billing: {
    billingAnchorDay: number;
    autoRenew: boolean;
    cancelAtPeriodEnd: boolean;
    canceledAt: string | null;
    nextDueDate: string | null;
    recurringAmount: number;
    recurringScheduled: boolean;
    openInvoice: { paymentId: string; amount: number; dueDate: string | null; overdue: boolean } | null;
  } | null;
  contract: { version: string; acceptedAt: string } | null;
}

/**
 * Consulta planos centralizados na API
 */
export async function getPlans(): Promise<PlanConfig[]> {
  const response = await api.get<{ success: boolean; data: PlanConfig[] }>("/payments/plans");
  return response.data.data;
}

/**
 * Cria cobrança Pix para plano pago
 */
export async function createPayment(input: CreatePaymentDto, idempotencyKey?: string): Promise<CreatePaymentResponse> {
  const response = await api.post<{ success: boolean; data: CreatePaymentResponse }>(
    "/payments/create",
    input,
    // Criar a cobrança faz várias chamadas ao Asaas: o timeout padrão (10s) é curto para esta rota
    { headers: { "Idempotency-Key": idempotencyKey || crypto.randomUUID() }, timeout: 30_000 },
  );
  return response.data.data;
}

/**
 * Consulta status de um pagamento
 */
export async function getPayment(paymentId: string): Promise<CreatePaymentResponse> {
  const response = await api.get<{ success: boolean; data: CreatePaymentResponse }>(
    `/payments/${paymentId}`,
  );
  return response.data.data;
}

export async function resendPaymentActivationCode(paymentId: string): Promise<{ sent: boolean; expiresAt: string }> {
  const response = await api.post<{ success: boolean; data: { sent: boolean; expiresAt: string } }>(
    `/payments/${paymentId}/activation-code/resend`,
  );
  return response.data.data;
}

/**
 * Ativa o plano validando o código de 6 dígitos enviado por e-mail
 */
export async function activateSubscription(
  input: ActivateSubscriptionDto,
): Promise<ActivateSubscriptionResponse> {
  const response = await api.post<{ success: boolean; data: ActivateSubscriptionResponse }>(
    "/subscriptions/activate",
    input,
  );
  return response.data.data;
}

/**
 * Consulta assinatura atual do usuário logado
 */
export async function getMySubscription(): Promise<GetMySubscriptionResponse> {
  const response = await api.get<{ success: boolean; data: GetMySubscriptionResponse }>(
    "/subscriptions/me",
  );
  return response.data.data;
}

/**
 * Inicia renovação manual de plano
 */
export async function renewSubscription(plan?: string): Promise<CreatePaymentResponse> {
  const response = await api.post<{ success: boolean; data: CreatePaymentResponse }>(
    "/subscriptions/renew",
    { plan },
  );
  return response.data.data;
}

/** Simulação do 1º pagamento (valor cheio, renovação mensal no dia da ativação) */
export async function getPaymentQuote(plan: string): Promise<PaymentQuote> {
  const response = await api.get<{ success: boolean; data: PaymentQuote }>("/payments/quote", { params: { plan } });
  return response.data.data;
}

/** Texto vigente do contrato de assinatura (público) */
export async function getSubscriptionContract(): Promise<SubscriptionContract> {
  const response = await api.get<{ success: boolean; data: SubscriptionContract }>("/contracts/subscription");
  return response.data.data;
}

/** Contrato que o usuário aceitou (texto exato da época do aceite) */
export async function getAcceptedContract(): Promise<{
  version: string;
  acceptedAt: string;
  contract: SubscriptionContract;
}> {
  const response = await api.get<{ success: boolean; data: { version: string; acceptedAt: string; contract: SubscriptionContract } }>(
    "/contracts/subscription/accepted",
  );
  return response.data.data;
}

/** Pagamento confirmado que ainda aguarda o código de ativação (null se não houver) */
export async function getPendingActivation(): Promise<{ paymentId: string; plan: string; amount: number } | null> {
  const response = await api.get<{ success: boolean; data: { paymentId: string; plan: string; amount: number } | null }>(
    "/payments/pending-activation",
  );
  return response.data.data;
}

/** Cancela a renovação automática (o plano segue até o fim do período pago) */
export async function cancelRenewal(): Promise<GetMySubscriptionResponse> {
  const response = await api.post<{ success: boolean; data: GetMySubscriptionResponse }>("/subscriptions/cancel");
  return response.data.data;
}

/** Reativa a renovação cancelada */
export async function reactivateRenewal(): Promise<GetMySubscriptionResponse> {
  const response = await api.post<{ success: boolean; data: GetMySubscriptionResponse }>("/subscriptions/reactivate");
  return response.data.data;
}
