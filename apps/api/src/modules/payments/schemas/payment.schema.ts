import { z } from "zod";

export const createPaymentSchema = z.object({
  plan: z.enum(["PROFESSIONAL", "PROFESSIONAL_PLUS"]),
  name: z.string().trim().min(3).max(100),
  email: z.string().trim().email().max(255),
  cpf: z.string().trim().min(1).max(32),
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
