import { z } from "zod";
import { api } from "./api";

const freelancerSchema = z.object({
  id: z.string(),
  name: z.string(),
  avatarUrl: z.string().optional(),
  headline: z.string().optional(),
  services: z.string().optional(),
  servicesTags: z.array(z.string()).optional(),
  bio: z.string().optional(),
});

const freelancersResponseSchema = z.object({
  success: z.literal(true),
  data: z.array(freelancerSchema),
  timestamp: z.string(),
});

export type FreelancerProfile = z.infer<typeof freelancerSchema>;

export async function listFreelancers(params?: { query?: string; limit?: number; offset?: number }): Promise<FreelancerProfile[]> {
  const response = await api.get("/users/freelancers", {
    params: params?.query
      ? { q: params.query, limit: params.limit, offset: params.offset }
      : { limit: params?.limit, offset: params?.offset },
  });
  const parsed = freelancersResponseSchema.parse(response.data);
  return parsed.data;
}

export async function getFreelancer(id: string): Promise<FreelancerProfile> {
  const response = await api.get(`/users/freelancers/${id}`);
  const parsed = z
    .object({
      success: z.literal(true),
      data: freelancerSchema,
      timestamp: z.string(),
    })
    .parse(response.data);
  return parsed.data;
}
