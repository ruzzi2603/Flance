import { z } from "zod";

export const createProposalSchema = z.object({
  text: z.string().trim().min(10).max(2000),
  bidAmount: z.coerce.number().positive(),
});

export const updateProposalSchema = z.object({
  status: z.enum(["ACCEPTED", "REJECTED"]),
});

export const updateProposalBidSchema = z.object({
  bidAmount: z.coerce.number().positive(),
});

export const cancelProposalSchema = z.object({
  reason: z.string().trim().min(10).max(2000),
});

export type CreateProposalInput = z.infer<typeof createProposalSchema>;
export type UpdateProposalInput = z.infer<typeof updateProposalSchema>;
export type UpdateProposalBidInput = z.infer<typeof updateProposalBidSchema>;
export type CancelProposalInput = z.infer<typeof cancelProposalSchema>;
