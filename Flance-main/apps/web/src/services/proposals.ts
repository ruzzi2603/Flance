import { z } from "zod";
import { api } from "./api";
import type { ProposalSummary } from "@flance/types";

const proposalSummarySchema = z.object({
  id: z.string(),
  status: z.enum(["PENDING", "ACCEPTED", "REJECTED", "CANCELLED"]),
  text: z.string(),
  bidAmount: z.number(),
  createdAt: z.string(),
  job: z.object({
    id: z.string(),
    title: z.string(),
    category: z.string(),
    clientId: z.string(),
  }),
  freelancer: z.object({
    id: z.string(),
    name: z.string(),
    email: z.string().email(),
    avatarUrl: z.string().optional().nullable(),
  }),
  conversationId: z.string().optional().nullable(),
  lastMessage: z
    .object({
      id: z.string(),
      body: z.string(),
      createdAt: z.string(),
      senderId: z.string(),
    })
    .optional()
    .nullable(),
});

const proposalsResponseSchema = z.object({
  success: z.literal(true),
  data: z.array(proposalSummarySchema),
  timestamp: z.string(),
});

export async function createProposal(jobId: string, input: { text: string; bidAmount: number }): Promise<ProposalSummary> {
  try {
    const response = await api.post(`/jobs/${jobId}/proposals`, input);
    const parsed = z
      .object({
        success: z.literal(true),
        data: proposalSummarySchema,
        timestamp: z.string(),
      })
      .parse(response.data);
    return parsed.data;
  } catch (error) {
    if (error instanceof Error && "response" in error) {
      const axiosError = error as { response?: { status?: number; data?: { message?: string } } };
      const status = axiosError.response?.status;
      if (status === 409) {
        throw new Error("Voce ja enviou uma proposta para este projeto.");
      }
      const message = axiosError.response?.data?.message;
      if (message) {
        throw new Error(message);
      }
    }
    throw error;
  }
}

export async function listReceivedProposals(): Promise<ProposalSummary[]> {
  const response = await api.get("/proposals/received");
  const parsed = proposalsResponseSchema.parse(response.data);
  return parsed.data;
}

export async function listSentProposals(): Promise<ProposalSummary[]> {
  const response = await api.get("/proposals/sent");
  const parsed = proposalsResponseSchema.parse(response.data);
  return parsed.data;
}

export async function updateProposalStatus(proposalId: string, status: "ACCEPTED" | "REJECTED") {
  const response = await api.patch(`/proposals/${proposalId}`, { status });
  const parsed = z
    .object({
      success: z.literal(true),
      data: z.object({
        id: z.string(),
        status: z.enum(["PENDING", "ACCEPTED", "REJECTED", "CANCELLED"]),
      }),
      timestamp: z.string(),
    })
    .parse(response.data);
  return parsed.data;
}

export async function updateProposalBid(proposalId: string, bidAmount: number) {
  const response = await api.patch(`/proposals/${proposalId}/bid`, { bidAmount });
  const parsed = z
    .object({
      success: z.literal(true),
      data: z.object({
        id: z.string(),
        status: z.enum(["PENDING", "ACCEPTED", "REJECTED", "CANCELLED"]),
        bidAmount: z.number(),
      }),
      timestamp: z.string(),
    })
    .parse(response.data);
  return parsed.data;
}

export async function cancelProposal(proposalId: string, reason: string) {
  const response = await api.post(`/proposals/${proposalId}/cancel`, { reason });
  const parsed = z
    .object({
      success: z.literal(true),
      data: z.object({
        id: z.string(),
        status: z.enum(["PENDING", "ACCEPTED", "REJECTED", "CANCELLED"]),
      }),
      timestamp: z.string(),
    })
    .parse(response.data);
  return parsed.data;
}
