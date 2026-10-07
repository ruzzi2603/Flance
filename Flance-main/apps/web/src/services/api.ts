import axios, { AxiosError, type InternalAxiosRequestConfig } from "axios";
import { z } from "zod";
import type { ApiSuccess, HealthResponse } from "@flance/types";
import type { AppUser } from "../types/auth";

export const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

export const api = axios.create({
  baseURL: `${API_BASE_URL}/v1`,
  timeout: 10_000,
  withCredentials: true,
  headers: {
    "Content-Type": "application/json",
  },
});

// Keep the short-lived access token only in memory. This lets retries use the token
// returned by /auth/refresh even when the browser has not applied its Set-Cookie yet.
let accessToken: string | null = null;

export function setAccessToken(token: string | null) {
  accessToken = token;
}

api.interceptors.request.use((config) => {
  if (accessToken) {
    config.headers.Authorization = `Bearer ${accessToken}`;
  }
  return config;
});

const authApi = axios.create({
  baseURL: `${API_BASE_URL}/v1`,
  timeout: 10_000,
  withCredentials: true,
});

let refreshPromise: Promise<void> | null = null;

async function refreshSession() {
  const response = await authApi.post<{ accessToken: string }>("/auth/refresh");
  setAccessToken(response.data.accessToken);
}

api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const config = error.config as (InternalAxiosRequestConfig & { _retry?: boolean }) | undefined;
    const status = error.response?.status;
    const url = config?.url ?? "";

    if (!config || status !== 401) {
      return Promise.reject(error);
    }

    if (
      config._retry ||
      url.includes("/auth/login") ||
      url.includes("/auth/register") ||
      url.includes("/auth/refresh") ||
      url.includes("/auth/logout")
    ) {
      return Promise.reject(error);
    }

    config._retry = true;

    try {
      if (!refreshPromise) {
        refreshPromise = refreshSession().finally(() => {
          refreshPromise = null;
        });
      }

      await refreshPromise;
      return api(config);
    } catch (refreshError) {
      setAccessToken(null);
      return Promise.reject(refreshError);
    }
  },
);

const healthSchema = z.object({
  success: z.literal(true),
  data: z.object({
    service: z.literal("flance-api"),
    status: z.literal("ok"),
    version: z.string(),
  }),
  timestamp: z.string(),
});

export async function getApiHealth(): Promise<ApiSuccess<HealthResponse>> {
  const response = await api.get("/health");
  return healthSchema.parse(response.data);
}

const authMeSchema = z.object({
  success: z.literal(true),
  data: z.object({
    id: z.string(),
    email: z.string().email(),
    role: z.enum(["CLIENT", "FREELANCER", "ADMIN"]),
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

export async function getCurrentUser(): Promise<ApiSuccess<AppUser>> {
  const response = await api.get("/auth/me");
  const parsed = authMeSchema.parse(response.data);
  return {
    success: true,
    data: {
      id: parsed.data.id,
      email: parsed.data.email,
      role: parsed.data.role,
      name: parsed.data.name,
      avatarUrl: parsed.data.avatarUrl,
      headline: parsed.data.headline,
      services: parsed.data.services,
      servicesTags: parsed.data.servicesTags,
      needs: parsed.data.needs,
      bio: parsed.data.bio,
      companyEnabled: parsed.data.companyEnabled,
      companyName: parsed.data.companyName,
      companyCnpj: parsed.data.companyCnpj,
      companyDescription: parsed.data.companyDescription,
      companyLocation: parsed.data.companyLocation,
      companyCity: parsed.data.companyCity,
      companyState: parsed.data.companyState,
      companyAddress: parsed.data.companyAddress,
      companyWebsite: parsed.data.companyWebsite,
      companyInstagram: parsed.data.companyInstagram,
      companyWhatsapp: parsed.data.companyWhatsapp,
      companyEmail: parsed.data.companyEmail,
      companyHours: parsed.data.companyHours,
      companyPhotos: parsed.data.companyPhotos,
      companyIsOnline: parsed.data.companyIsOnline,
      companyIsPhysical: parsed.data.companyIsPhysical,
      companyViews: parsed.data.companyViews,
      planTier: parsed.data.planTier,
    },
    timestamp: parsed.timestamp,
  };
}
