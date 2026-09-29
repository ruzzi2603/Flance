import { z } from "zod";

export const createPaymentSchema = z.object({
  plan: z.string().min(1, "Plano é obrigatório"),
  name: z.string().min(1, "Nome completo é obrigatório"),
  email: z.string().email("E-mail inválido"),
  cpf: z.string().min(1, "CPF é obrigatório"),
});

export type CreatePaymentInput = z.infer<typeof createPaymentSchema>;

export const activateSubscriptionSchema = z.object({
  paymentId: z.string().min(1, "ID do pagamento é obrigatório"),
  code: z
    .string()
    .trim()
    .regex(/^\d{6}$/, "O código de ativação deve conter exatamente 6 dígitos"),
});

export type ActivateSubscriptionInput = z.infer<typeof activateSubscriptionSchema>;

export const renewSubscriptionSchema = z.object({
  plan: z.string().optional(),
});

export type RenewSubscriptionInput = z.infer<typeof renewSubscriptionSchema>;
