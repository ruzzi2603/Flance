import { ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../../common/prisma/prisma.service";
import { RealtimeService } from "./realtime.service";

export interface ConversationSummary {
  id: string;
  company: { id: string; name: string; location?: string | null };
  client: { id: string; name: string; avatarUrl?: string | null };
  freelancer: { id: string; name: string; avatarUrl?: string | null };
  lastMessage?: { id: string; body: string; createdAt: string; senderId: string } | null;
}

export interface MessageEntity {
  id: string;
  conversationId: string;
  senderId: string;
  body: string;
  createdAt: string;
}

export interface ConversationProposalSummary {
  id: string;
  status: "PENDING" | "ACCEPTED" | "REJECTED" | "CANCELLED";
  bidAmount: number;
  text: string;
  job: { id: string; title: string };
  clientId: string;
  freelancerId: string;
 }

@Injectable()
export class ChatService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly realtimeService: RealtimeService,
  ) {}

  private toSummary(conversation: {
    id: string;
    client: { id: string; name: string; avatarUrl?: string | null };
    freelancer: { id: string; name: string; avatarUrl?: string | null; companyName?: string | null; companyLocation?: string | null };
    messages?: { id: string; body: string; createdAt: Date; senderId: string }[];
  }): ConversationSummary {
    return {
      id: conversation.id,
      company: {
        id: conversation.freelancer.id,
        name: conversation.freelancer.companyName || conversation.freelancer.name,
        location: conversation.freelancer.companyLocation ?? undefined,
      },
      client: {
        id: conversation.client.id,
        name: conversation.client.name,
        avatarUrl: conversation.client.avatarUrl ?? undefined,
      },
      freelancer: {
        id: conversation.freelancer.id,
        name: conversation.freelancer.name,
        avatarUrl: conversation.freelancer.avatarUrl ?? undefined,
      },
      lastMessage: conversation.messages?.[0]
        ? {
            id: conversation.messages[0].id,
            body: conversation.messages[0].body,
            createdAt: conversation.messages[0].createdAt.toISOString(),
            senderId: conversation.messages[0].senderId,
          }
        : null,
    };
  }

  async listConversations(userId: string): Promise<ConversationSummary[]> {
    const conversations = await this.prisma.conversation.findMany({
      where: {
        OR: [{ clientId: userId }, { freelancerId: userId }],
      },
      orderBy: { updatedAt: "desc" },
      include: {
        client: true,
        freelancer: {
          select: {
            id: true,
            name: true,
            avatarUrl: true,
            companyName: true,
            companyLocation: true,
          },
        },
        messages: {
          orderBy: { createdAt: "desc" },
          take: 1,
        },
      },
    });

    return conversations.map((conversation) => this.toSummary(conversation));
  }

  async listMessages(conversationId: string, userId: string): Promise<MessageEntity[]> {
    const conversation = await this.prisma.conversation.findUnique({
      where: { id: conversationId },
      select: { clientId: true, freelancerId: true },
    });

    if (!conversation) {
      throw new NotFoundException("Conversation not found");
    }

    if (conversation.clientId !== userId && conversation.freelancerId !== userId) {
      throw new ForbiddenException("Not allowed");
    }

    const messages = await this.prisma.message.findMany({
      where: { conversationId },
      orderBy: { createdAt: "asc" },
    });

    return messages.map((message) => ({
      id: message.id,
      conversationId: message.conversationId,
      senderId: message.senderId,
      body: message.body,
      createdAt: message.createdAt.toISOString(),
    }));
  }

  async sendMessage(conversationId: string, userId: string, body: string): Promise<MessageEntity> {
    const conversation = await this.prisma.conversation.findUnique({
      where: { id: conversationId },
      select: { clientId: true, freelancerId: true },
    });

    if (!conversation) {
      throw new NotFoundException("Conversation not found");
    }

    if (conversation.clientId !== userId && conversation.freelancerId !== userId) {
      throw new ForbiddenException("Not allowed");
    }

    const message = await this.prisma.message.create({
      data: {
        conversationId,
        senderId: userId,
        body,
      },
    });

    await this.prisma.conversation.update({
      where: { id: conversationId },
      data: { updatedAt: new Date() },
    });

    const messagePayload = {
      conversationId,
      message: {
        id: message.id,
        conversationId: message.conversationId,
        senderId: message.senderId,
        body: message.body,
        createdAt: message.createdAt.toISOString(),
      },
    };

    this.realtimeService.emitToConversation(conversationId, "message.created", messagePayload);
    this.realtimeService.emitToUser(conversation.clientId, "message.created", messagePayload);
    this.realtimeService.emitToUser(conversation.freelancerId, "message.created", messagePayload);

    return {
      id: message.id,
      conversationId: message.conversationId,
      senderId: message.senderId,
      body: message.body,
      createdAt: message.createdAt.toISOString(),
    };
  }

  async getOrCreateDirectConversation(clientId: string, freelancerId: string): Promise<ConversationSummary> {
    if (clientId === freelancerId) {
      throw new ForbiddenException("You cannot message yourself");
    }

    const freelancer = await this.prisma.user.findUnique({
      where: { id: freelancerId },
      select: { companyEnabled: true },
    });

    if (!freelancer || !freelancer.companyEnabled) {
      throw new NotFoundException("Empresa nao encontrada");
    }

    const existing = await this.prisma.conversation.findFirst({
      where: {
        clientId,
        freelancerId,
        jobId: null,
        proposalId: null,
      },
    });

    if (existing) {
      const hydrated = await this.prisma.conversation.findUnique({
        where: { id: existing.id },
        include: {
          client: true,
          freelancer: {
            select: {
              id: true,
              name: true,
              avatarUrl: true,
              companyName: true,
              companyLocation: true,
            },
          },
          messages: {
            orderBy: { createdAt: "desc" },
            take: 1,
          },
        },
      });
      if (!hydrated) {
        throw new NotFoundException("Conversation not found");
      }
      return this.toSummary(hydrated);
    }

    const created = await this.prisma.conversation.create({
      data: {
        clientId,
        freelancerId,
      },
    });

    const hydrated = await this.prisma.conversation.findUnique({
      where: { id: created.id },
      include: {
        client: true,
        freelancer: {
          select: {
            id: true,
            name: true,
            avatarUrl: true,
            companyName: true,
            companyLocation: true,
          },
        },
        messages: {
          orderBy: { createdAt: "desc" },
          take: 1,
        },
      },
    });

    if (!hydrated) {
      throw new NotFoundException("Conversation not found");
    }
    return this.toSummary(hydrated);
  }

  async getConversationProposal(
    conversationId: string,
    userId: string,
  ): Promise<ConversationProposalSummary | null> {
    const conversation = await this.prisma.conversation.findUnique({
      where: { id: conversationId },
      include: {
        job: true,
        proposal: true,
      },
    });

    if (!conversation) {
      throw new NotFoundException("Conversation not found");
    }

    if (conversation.clientId !== userId && conversation.freelancerId !== userId) {
      throw new ForbiddenException("Not allowed");
    }

    if (!conversation.proposal) {
      return null;
    }

    return {
      id: conversation.proposal.id,
      status: conversation.proposal.status,
      bidAmount: Number(conversation.proposal.bidAmount),
      text: conversation.proposal.text,
      job: {
        id: conversation.job?.id ?? conversation.proposal.jobId,
        title: conversation.job?.title ?? "Projeto",
      },
      clientId: conversation.clientId,
      freelancerId: conversation.freelancerId,
    };
  }
}
