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
  companyCnpj: z.string().min(8).max(32).optional(),
  companyDescription: z.string().min(10).max(1000).optional(),
  companyLocation: z.string().min(2).max(160).optional(),
  companyCity: z.string().min(2).max(80).optional(),
  companyState: z.string().min(2).max(80).optional(),
  companyAddress: z.string().min(2).max(180).optional(),
  companyWebsite: z.string().min(5).max(240).optional(),
  companyInstagram: z.string().min(2).max(140).optional(),
  companyWhatsapp: z.string().min(6).max(32).optional(),
  companyEmail: z.string().email().optional(),
  companyHours: z.string().min(2).max(140).optional(),
  companyPhotos: z.array(z.string().min(4).max(4000000)).max(8).optional(),
  companyIsOnline: z.boolean().optional(),
  companyIsPhysical: z.boolean().optional(),
  planTier: z.enum(["FREE", "BASIC", "PRO", "PREMIUM"]).optional(),
});

export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
