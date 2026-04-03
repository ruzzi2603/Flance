import { z } from "zod";
import axios from "axios";
import { api } from "./api";
import type { AppUser } from "../types/auth";

const authUserSchema = z.object({
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
});

const authResponseSchema = z.object({
  accessToken: z.string(),
  user: authUserSchema,
});

export type AuthUser = z.infer<typeof authUserSchema>;
export type AuthResponse = z.infer<typeof authResponseSchema>;

export async function login(input: { email: string; password: string }): Promise<AuthResponse> {
  const response = await api.post("/auth/login", input);
  const parsed = authResponseSchema.parse(response.data);
  return parsed;
}

export async function register(input: {
  name: string;
  email: string;
  password: string;
  avatarUrl?: string;
}): Promise<AuthResponse> {
  const response = await api.post("/auth/register", input);
  const parsed = authResponseSchema.parse(response.data);
  return parsed;
}

export async function logout(): Promise<void> {
  try {
    await api.post("/auth/logout");
  } catch (error) {
    if (axios.isAxiosError(error) && error.response?.status === 401) {
      return;
    }
    throw error;
  }
}

export async function requestPasswordReset(email: string): Promise<{ sent: boolean; resetUrl?: string }> {
  const response = await fetch("/api/auth/password/forgot", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email }),
  });
  if (!response.ok) {
    throw new Error("Nao foi possivel enviar o link.");
  }
  const payload = (await response.json()) as { data?: { sent: boolean; resetUrl?: string } };
  return payload.data ?? { sent: true };
}

export async function getResetOptions(token: string): Promise<string[]> {
  const response = await fetch(`/api/auth/password/verify-options?token=${encodeURIComponent(token)}`);
  if (!response.ok) {
    throw new Error("Nao foi possivel carregar os codigos.");
  }
  const payload = (await response.json()) as { data?: { options: string[] } };
  return payload.data?.options ?? [];
}

export async function verifyResetCode(token: string, code: string): Promise<string> {
  const response = await fetch("/api/auth/password/verify", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token, code }),
  });
  if (!response.ok) {
    throw new Error("Codigo incorreto.");
  }
  const payload = (await response.json()) as { data?: { resetToken: string } };
  if (!payload.data?.resetToken) {
    throw new Error("Token invalido.");
  }
  return payload.data.resetToken;
}

export async function resetPassword(token: string, password: string): Promise<void> {
  const response = await fetch("/api/auth/password/reset", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token, password }),
  });
  if (!response.ok) {
    throw new Error("Nao foi possivel redefinir a senha.");
  }
}

export function toAppUser(user: AuthUser): AppUser {
  return user;
}
