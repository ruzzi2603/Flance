import { z } from "zod";
import { api } from "./api";
import type { AppUser } from "../types/auth";

const profileSchema = z.object({
  success: z.literal(true),
  data: z.object({
    id: z.string(),
    email: z.string().email(),
    role: z.enum(["CLIENT", "FREELANCER"]),
    name: z.string().optional(),
    avatarUrl: z.string().optional(),
    headline: z.string().optional(),
    services: z.string().optional(),
    servicesTags: z.array(z.string()).optional(),
    needs: z.string().optional(),
    bio: z.string().optional(),
    companyEnabled: z.boolean().optional(),
    companyName: z.string().optional(),
    companyCnpj: z.string().optional(),
    companyDescription: z.string().optional(),
    companyLocation: z.string().optional(),
    companyCity: z.string().optional(),
    companyState: z.string().optional(),
    companyAddress: z.string().optional(),
    companyWebsite: z.string().optional(),
    companyInstagram: z.string().optional(),
    companyWhatsapp: z.string().optional(),
    companyEmail: z.string().optional(),
    companyHours: z.string().optional(),
    companyPhotos: z.array(z.string()).optional(),
    companyIsOnline: z.boolean().optional(),
    companyIsPhysical: z.boolean().optional(),
    companyViews: z.number().optional(),
    planTier: z.string().optional(),
  }),
  timestamp: z.string(),
});

export async function updateProfile(input: {
  name?: string;
  avatarUrl?: string;
  role?: "CLIENT" | "FREELANCER";
  servicesTags?: string[];
  headline?: string;
  services?: string;
  bio?: string;
  needs?: string;
  companyEnabled?: boolean;
  companyName?: string;
  companyCnpj?: string;
  companyDescription?: string;
  companyLocation?: string;
  companyCity?: string;
  companyState?: string;
  companyAddress?: string;
  companyWebsite?: string;
  companyInstagram?: string;
  companyWhatsapp?: string;
  companyEmail?: string;
  companyHours?: string;
  companyPhotos?: string[];
  companyIsOnline?: boolean;
  companyIsPhysical?: boolean;
  planTier?: "FREE" | "BASIC" | "PRO" | "PREMIUM";
}): Promise<AppUser> {
  const response = await api.patch("/users/me", input);
  const parsed = profileSchema.parse(response.data);
  return parsed.data;
}

const publicProfileSchema = z.object({
  id: z.string(),
  name: z.string(),
  avatarUrl: z.string().optional().nullable(),
  headline: z.string().optional().nullable(),
  services: z.string().optional().nullable(),
  servicesTags: z.array(z.string()).optional(),
  bio: z.string().optional().nullable(),
});

export async function getPublicUser(id: string) {
  const response = await api.get(`/users/public/${id}`);
  const parsed = z
    .object({
      success: z.literal(true),
      data: publicProfileSchema,
      timestamp: z.string(),
    })
    .parse(response.data);
  return {
    id: parsed.data.id,
    name: parsed.data.name,
    avatarUrl: parsed.data.avatarUrl ?? undefined,
    headline: parsed.data.headline ?? undefined,
    services: parsed.data.services ?? undefined,
    servicesTags: parsed.data.servicesTags ?? [],
    bio: parsed.data.bio ?? undefined,
  };
}
