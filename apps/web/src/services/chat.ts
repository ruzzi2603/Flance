import { z } from "zod";
import { api } from "./api";
import type { ConversationSummary, MessageEntity } from "@flance/types";

const conversationSchema = z.object({
  id: z.string(),
  company: z.object({
    id: z.string(),
    name: z.string(),
    location: z.string().optional().nullable(),
  }),
  client: z.object({
    id: z.string(),
    name: z.string(),
    avatarUrl: z.string().optional().nullable(),
  }),
  freelancer: z.object({
    id: z.string(),
    name: z.string(),
    avatarUrl: z.string().optional().nullable(),
  }),
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

const messageSchema = z.object({
  id: z.string(),
  conversationId: z.string(),
  senderId: z.string(),
  body: z.string(),
  createdAt: z.string(),
});

export async function listConversations(): Promise<ConversationSummary[]> {
  const response = await api.get("/conversations");
  const parsed = z
    .object({
      success: z.literal(true),
      data: z.array(conversationSchema),
      timestamp: z.string(),
    })
    .parse(response.data);
  return parsed.data;
}

export async function listMessages(conversationId: string): Promise<MessageEntity[]> {
  const response = await api.get(`/conversations/${conversationId}/messages`);
  const parsed = z
    .object({
      success: z.literal(true),
      data: z.array(messageSchema),
      timestamp: z.string(),
    })
    .parse(response.data);
  return parsed.data;
}

export async function sendMessage(conversationId: string, body: string): Promise<MessageEntity> {
  const response = await api.post(`/conversations/${conversationId}/messages`, { body });
  const parsed = z
    .object({
      success: z.literal(true),
      data: messageSchema,
      timestamp: z.string(),
    })
    .parse(response.data);
  return parsed.data;
}

export async function createDirectConversation(companyId: string): Promise<ConversationSummary> {
  const response = await api.post("/conversations/direct", { freelancerId: companyId });
  const parsed = z
    .object({
      success: z.literal(true),
      data: conversationSchema,
      timestamp: z.string(),
    })
    .parse(response.data);
  return parsed.data;
}
