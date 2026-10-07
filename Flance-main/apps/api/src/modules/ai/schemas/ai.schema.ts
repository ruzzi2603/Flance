import { z } from "zod";

export const aiMatchSchema = z.object({
  description: z.string().min(10).max(5000),
  freelancers: z.array(
    z.object({
      id: z.string().min(1),
      skills: z.array(z.string().min(1)).min(1),
    }),
  ).min(1),
});

export type AiMatchInput = z.infer<typeof aiMatchSchema>;
