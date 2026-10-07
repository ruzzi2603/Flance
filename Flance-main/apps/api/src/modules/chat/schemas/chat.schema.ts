import { z } from "zod";

export const createMessageSchema = z.object({
  body: z.string().trim().min(1).max(2000),
});

export type CreateMessageInput = z.infer<typeof createMessageSchema>;

export const createDirectConversationSchema = z.object({
  freelancerId: z.string().min(1),
});

export type CreateDirectConversationInput = z.infer<typeof createDirectConversationSchema>;
