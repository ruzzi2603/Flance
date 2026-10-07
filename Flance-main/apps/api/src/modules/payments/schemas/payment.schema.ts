import { z } from "zod";

export const createPaymentSchema = z.object({
  plan: z.enum(["PROFESSIONAL", "PROFESSIONAL_PLUS"]),
  name: z.string().trim().min(3).max(100),
  email: z.string().trim().email().max(255),
  cpf: z.string().trim().min(1).max(32),
  // Aceite do contrato: o texto exibido é identificado por versão + hash (validados no servidor)
  acceptContract: z.literal(true, { errorMap: () => ({ message: "É necessário aceitar o contrato para continuar." }) }),
  contractVersion: z.string().trim().min(1).max(64),
  contractHash: z.string().trim().length(64),
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

export const renewSubscriptionSchema = z.object({}).passthrough();

export type RenewSubscriptionInput = z.infer<typeof renewSubscriptionSchema>;
