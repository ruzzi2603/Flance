import { z } from "zod";

export const companyVisitSchema = z.object({
  sessionId: z.string().min(8).max(100),
});

export const companyVisitDurationSchema = z.object({
  durationSeconds: z.number().int().min(0).max(86_400),
});

export const companyShareSchema = z.object({
  sessionId: z.string().min(8).max(100),
  source: z.enum(["native", "copy", "whatsapp", "facebook", "x", "email"]),
});