import { Body, Controller, Get, Param, Post, UseGuards } from "@nestjs/common";
import { CurrentUser, type JwtUserPayload } from "../../common/decorators/current-user.decorator";
import { ZodValidationPipe } from "../../common/pipes/zod-validation.pipe";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { ChatService } from "./chat.service";
import {
  createDirectConversationSchema,
  createMessageSchema,
  type CreateDirectConversationInput,
  type CreateMessageInput,
} from "./schemas/chat.schema";

@Controller("conversations")
@UseGuards(JwtAuthGuard)
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  @Get()
  async list(@CurrentUser() user: JwtUserPayload) {
    const conversations = await this.chatService.listConversations(user.sub);
    return { success: true, data: conversations, timestamp: new Date().toISOString() };
  }

  @Post("direct")
  async createDirect(
    @Body(new ZodValidationPipe(createDirectConversationSchema)) body: CreateDirectConversationInput,
    @CurrentUser() user: JwtUserPayload,
  ) {
    const conversation = await this.chatService.getOrCreateDirectConversation(user.sub, body.freelancerId);
    return { success: true, data: conversation, timestamp: new Date().toISOString() };
  }

  @Get(":id/messages")
  async listMessages(@Param("id") conversationId: string, @CurrentUser() user: JwtUserPayload) {
    const messages = await this.chatService.listMessages(conversationId, user.sub);
    return { success: true, data: messages, timestamp: new Date().toISOString() };
  }

  @Get(":id/proposal")
  async getProposal(@Param("id") conversationId: string, @CurrentUser() user: JwtUserPayload) {
    const proposal = await this.chatService.getConversationProposal(conversationId, user.sub);
    return { success: true, data: proposal, timestamp: new Date().toISOString() };
  }

  @Post(":id/messages")
  async sendMessage(
    @Param("id") conversationId: string,
    @Body(new ZodValidationPipe(createMessageSchema)) body: CreateMessageInput,
    @CurrentUser() user: JwtUserPayload,
  ) {
    const message = await this.chatService.sendMessage(conversationId, user.sub, body.body);
    return { success: true, data: message, timestamp: new Date().toISOString() };
  }
}

