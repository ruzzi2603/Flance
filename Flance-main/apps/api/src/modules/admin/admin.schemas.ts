import { z } from "zod";

export const moderationReasonSchema = z.object({
  reason: z.string().trim().min(10).max(1000),
});

export const adModerationSchema = moderationReasonSchema.extend({
  active: z.boolean(),
});

export type ModerationReasonInput = z.infer<typeof moderationReasonSchema>;
export type AdModerationInput = z.infer<typeof adModerationSchema>;