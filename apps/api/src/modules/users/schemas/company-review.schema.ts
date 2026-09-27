import { z } from "zod";

export const companyReviewSchema = z.object({
  rating: z.coerce.number().int().min(1).max(5),
  comment: z.string().trim().max(1000).nullable().optional(),
});

export type CompanyReviewInput = z.infer<typeof companyReviewSchema>;