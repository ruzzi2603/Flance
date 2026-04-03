import { z } from "zod";

export const createJobSchema = z.object({
  title: z.string().trim().min(5).max(120),
  description: z.string().trim().min(20).max(3000),
  budgetType: z.enum(["FIXED", "RANGE", "NEGOTIABLE"]),
  budget: z.coerce.number().positive().optional(),
  budgetMin: z.coerce.number().positive().optional(),
  budgetMax: z.coerce.number().positive().optional(),
  category: z.string().trim().min(2).max(60),
}).superRefine((value, ctx) => {
  if (value.budgetType === "FIXED") {
    if (value.budget === undefined) {
      ctx.addIssue({ code: "custom", path: ["budget"], message: "Required" });
    }
  }
  if (value.budgetType === "RANGE") {
    if (value.budgetMin === undefined || value.budgetMax === undefined) {
      ctx.addIssue({ code: "custom", path: ["budget"], message: "Required" });
    } else if (value.budgetMax < value.budgetMin) {
      ctx.addIssue({ code: "custom", path: ["budget"], message: "Invalid range" });
    }
  }
});

export type CreateJobInput = z.infer<typeof createJobSchema>;
