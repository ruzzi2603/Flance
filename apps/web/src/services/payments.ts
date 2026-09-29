import { api } from "./api";
import type {
  ActivateSubscriptionDto,
  ActivateSubscriptionResponse,
  CreatePaymentDto,
  CreatePaymentResponse,
  PlanConfig,
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
export async function createPayment(input: CreatePaymentDto): Promise<CreatePaymentResponse> {
  const response = await api.post<{ success: boolean; data: CreatePaymentResponse }>(
    "/payments/create",
    input,
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
