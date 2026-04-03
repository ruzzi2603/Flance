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

const authApi = axios.create({
  baseURL: `${API_BASE_URL}/v1`,
  timeout: 10_000,
  withCredentials: true,
});

let refreshPromise: Promise<void> | null = null;

async function refreshSession() {
  await authApi.post("/auth/refresh");
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
    role: z.enum(["CLIENT", "FREELANCER"]),
    name: z.string().optional(),
    avatarUrl: z.string().optional(),
    headline: z.string().optional(),
    services: z.string().optional(),
    servicesTags: z.array(z.string()).optional(),
    needs: z.string().optional(),
    bio: z.string().optional(),
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
    },
    timestamp: parsed.timestamp,
  };
}
