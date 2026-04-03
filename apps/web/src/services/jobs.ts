import { z } from "zod";
import axios from "axios";
import { api } from "./api";

export const jobSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string(),
  budgetType: z.enum(["FIXED", "RANGE", "NEGOTIABLE"]),
  budget: z.number().nullable(),
  budgetMin: z.number().nullable(),
  budgetMax: z.number().nullable(),
  category: z.string(),
  status: z.enum(["OPEN", "IN_PROGRESS", "COMPLETED"]),
  clientId: z.string(),
  clientName: z.string().optional(),
  clientAvatarUrl: z.string().optional().nullable(),
  createdAt: z.string(),
});

const jobsResponseSchema = z.object({
  success: z.literal(true),
  data: z.array(jobSchema),
  timestamp: z.string(),
});

export type Job = z.infer<typeof jobSchema>;

export async function listJobs(params?: { query?: string; limit?: number; offset?: number }): Promise<Job[]> {
  const response = await api.get("/jobs", {
    params: params?.query
      ? { q: params.query, limit: params.limit, offset: params.offset }
      : { limit: params?.limit, offset: params?.offset },
  });
  const parsed = jobsResponseSchema.parse(response.data);
  return parsed.data;
}

export async function getJob(jobId: string): Promise<Job> {
  const response = await api.get(`/jobs/${jobId}`);
  const parsed = z
    .object({
      success: z.literal(true),
      data: jobSchema,
      timestamp: z.string(),
    })
    .parse(response.data);
  return parsed.data;
}

export async function createJob(input: {
  title: string;
  description: string;
  budgetType: "FIXED" | "RANGE" | "NEGOTIABLE";
  budget?: number;
  budgetMin?: number;
  budgetMax?: number;
  category: string;
}): Promise<Job> {
  try {
    const response = await api.post("/jobs", input);
    const parsed = z
      .object({
        success: z.literal(true),
        data: jobSchema,
        timestamp: z.string(),
      })
      .parse(response.data);
    return parsed.data;
  } catch (error) {
    if (axios.isAxiosError(error)) {
      const data = error.response?.data as {
        message?: string;
        errors?: { fieldErrors?: Record<string, string[]> };
      };
      const message = data?.message;
      const fieldErrors = data?.errors?.fieldErrors;
      const err = new Error(message || "Nao foi possivel criar o projeto.") as Error & {
        fieldErrors?: Record<string, string[]>;
      };
      if (fieldErrors) {
        err.fieldErrors = fieldErrors;
      }
      throw err;
    }
    throw error;
  }
}
