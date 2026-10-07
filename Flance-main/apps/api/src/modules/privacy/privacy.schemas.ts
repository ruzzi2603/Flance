import { z } from "zod";
import { DELETE_CONFIRMATION_WORD } from "./retention-policy";

export const exportDataSchema = z.object({
  password: z.string().min(1, "Informe sua senha.").max(200),
});

export const deleteAccountSchema = z.object({
  password: z.string().min(1, "Informe sua senha.").max(200),
  confirmation: z.literal(DELETE_CONFIRMATION_WORD, {
    errorMap: () => ({ message: `Digite ${DELETE_CONFIRMATION_WORD} para confirmar.` }),
  }),
});

export type ExportDataInput = z.infer<typeof exportDataSchema>;
export type DeleteAccountInput = z.infer<typeof deleteAccountSchema>;
