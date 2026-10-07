import { z } from "zod";

export const updateProfileSchema = z.object({
  name: z.string().min(2).max(120).optional(),
  avatarUrl: z.string().min(3).max(3000000).optional(),
  bio: z.string().min(10).max(500).optional(),
  headline: z.string().min(6).max(120).optional(),
  services: z.string().min(6).max(200).optional(),
  servicesTags: z.array(z.string().min(2).max(40)).max(3).optional(),
  needs: z.string().min(6).max(200).optional(),
  role: z.enum(["CLIENT", "FREELANCER"]).optional(),
  companyEnabled: z.boolean().optional(),
  companyName: z.string().min(2).max(140).optional(),
  companyCnpj: z.string().min(8).max(32).regex(/^[a-zA-Z0-9./-]+$/).optional(),
  companyDescription: z.string().min(10).max(1000).optional(),
  companyLocation: z.string().min(2).max(160).optional(),
  companyCity: z.string().min(2).max(80).optional(),
  companyState: z.string().min(2).max(80).optional(),
  companyAddress: z.string().min(2).max(180).optional(),
  companyWebsite: z.string().min(5).max(240).url().refine((value) => /^https?:\/\//i.test(value)).optional(),
  companyInstagram: z.string().min(2).max(140).optional(),
  companyWhatsapp: z.string().min(6).max(32).regex(/^[0-9+()\s-]+$/).optional(),
  companyEmail: z.string().email().optional(),
  companyHours: z.string().min(2).max(140).optional(),
  companyPhotos: z.array(z.string().min(4).max(4000000)).max(20).optional(),
  companyIsOnline: z.boolean().optional(),
  companyIsPhysical: z.boolean().optional(),
  planTier: z.enum(["FREE", "BASIC", "PRO", "PREMIUM", "PROFESSIONAL", "PROFESSIONAL_PLUS"]).optional(),
});

export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
