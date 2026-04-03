/**
 * CHAT GATEWAY - WebSocket para real-time chat
 *
 * Responsabilidades:
 * - Autenticação via JWT cookie
 * - Gerenciar conexões (connect/disconnect)
 * - Join conversation rooms
 * - Mensagens broadcast
 *
 * IMPORTANTE - Resilience:
 * ✅ CORS dinâmico (environment driven)
 * ✅ Validação de JWT na conexão
 * ✅ Logging de eventos
 * ✅ Error handling robusto
 *
 * TODO v1.1:
 * - Heartbeat/ping-pong para detectar conexões mortas
 * - Reconnection backoff exponencial
 * - Persistência de mensagens offline
 */

import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from "@nestjs/websockets";
import { JwtService } from "@nestjs/jwt";
import type { Server, Socket } from "socket.io";
import { PrismaService } from "../../common/prisma/prisma.service";
import { RealtimeService } from "./realtime.service";
import { LoggerService } from "../../common/logger/logger.service";

/**
 * Parse cookies do Header
 * Extrai JWT token do cookie string "key1=value1; key2=value2"
 */
function parseCookies(cookieHeader?: string) {
  if (!cookieHeader) return {};
  return cookieHeader.split(";").reduce<Record<string, string>>((acc, part) => {
    const [rawKey, ...rest] = part.trim().split("=");
    if (!rawKey) return acc;
    acc[rawKey] = decodeURIComponent(rest.join("="));
    return acc;
  }, {});
}

@WebSocketGateway({
  cors: {
    // ✅ IMPORTANTE: CORS dinâmico baseado em environment
    // Em dev: http://localhost:3000
    // Em prod: https://flance.com (configurado via env)
    origin: process.env.NODE_ENV === "production"
      ? (process.env.CORS_ORIGIN || "https://flance.com")
      : /^http:\/\/localhost:3000$/,
    credentials: true,
  },
})
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server!: Server;

  constructor(
    private readonly jwtService: JwtService,
    private readonly prisma: PrismaService,
    private readonly realtimeService: RealtimeService,
    private readonly logger: LoggerService,
  ) {}

  /**
   * Inicialização do gateway
   * Registra o server no RealtimeService para emissão de eventos
   */
  afterInit() {
    this.realtimeService.setServer(this.server);
    this.logger.info("ChatGateway initialized");
  }

  /**
   * Conexão de cliente
   *
   * Fluxo:
   * 1. Extrair JWT do cookie
   * 2. Validar JWT
   * 3. Adicionar userId ao socket.data
   * 4. Juntar room "user:{userId}" para emissões diretas
   *
   * IMPORTANTE:
   * - Desconectar se JWT inválido
   * - Desconectar se token expirado
   * - Log all connections (security audit)
   */
  async handleConnection(client: Socket) {
    try {
      // === 1. Extrair JWT do cookie ===
      const cookies = parseCookies(client.handshake.headers.cookie as string | undefined);
      const token = cookies["flance_access_token"];

      if (!token) {
        this.logger.warn("WebSocket connection rejected: No token", {
          clientId: client.id,
          ip: client.handshake.address,
        });
        client.disconnect();
        return;
      }

      // === 2. Validar JWT ===
      const payload = await this.jwtService.verifyAsync<{ sub: string }>(token);

      // === 3. Adicionar contexto ao socket ===
      client.data.userId = payload.sub;
      client.data.connectedAt = new Date();

      // === 4. Juntar room pessoal ===
      // Permite enviar mensagens diretas para este usuário
      client.join(`user:${payload.sub}`);

      this.logger.info("WebSocket client connected", {
        clientId: client.id,
        userId: payload.sub,
      });
    } catch (error) {
      // JWT inválido, expirado, ou erro de verificação
      this.logger.warn("WebSocket connection failed: Invalid JWT", {
        clientId: client.id,
        error: error instanceof Error ? error.message : String(error),
      });
      client.disconnect();
    }
  }

  /**
   * Desconexão de cliente
   * Limpar recursos
   */
  handleDisconnect(client: Socket) {
    const userId = client.data.userId as string | undefined;
    const duration = userId && client.data.connectedAt
      ? Date.now() - client.data.connectedAt.getTime()
      : 0;

    if (userId) {
      this.logger.debug("WebSocket client disconnected", {
        clientId: client.id,
        userId,
        duration,
      });
    }
  }

  /**
   * Join conversation room
   *
   * Validações:
   * 1. Cliente autenticado
   * 2. conversationId fornecido
   * 3. Conversa existe
   * 4. Usuário é participante (cliente ou freelancer)
   *
   * Após validação: cliente entra em room "conversation:{conversationId}"
   * Mensagens para esta conversation serão broadcast aqui
   *
   * Resposta: { success: true } ou { success: false }
   */
  @SubscribeMessage("join.conversation")
  async joinConversation(@ConnectedSocket() client: Socket, @MessageBody() body: { conversationId: string }) {
    const userId = client.data.userId as string | undefined;

    // === Validar autenticação ===
    if (!userId) {
      return { success: false, error: "Not authenticated" };
    }

    // === Validar conversationId ===
    if (!body?.conversationId) {
      return { success: false, error: "Missing conversationId" };
    }

    try {
      // === Buscar conversa ===
      const conversation = await this.prisma.conversation.findUnique({
        where: { id: body.conversationId },
        select: { clientId: true, freelancerId: true },
      });

      if (!conversation) {
        this.logger.warn("Join conversation failed: Conversation not found", {
          clientId: client.id,
          userId,
          conversationId: body.conversationId,
        });
        return { success: false, error: "Conversation not found" };
      }

      // === Validar permissão ===
      if (conversation.clientId !== userId && conversation.freelancerId !== userId) {
        this.logger.warn("Join conversation failed: Not participant", {
          clientId: client.id,
          userId,
          conversationId: body.conversationId,
        });
        return { success: false, error: "Not allowed" };
      }

      // === Juntar room ===
      client.join(`conversation:${body.conversationId}`);

      this.logger.debug("Client joined conversation", {
        userId,
        conversationId: body.conversationId,
      });

      return { success: true };
    } catch (error) {
      this.logger.error("Join conversation error", error as Error, {
        userId,
        conversationId: body.conversationId,
      });
      return { success: false, error: "Internal error" };
    }
  }

  /**
   * Leave conversation room
   * Simples - apenas sair do room
   */
  @SubscribeMessage("leave.conversation")
  leaveConversation(@ConnectedSocket() client: Socket, @MessageBody() body: { conversationId: string }) {
    if (!body?.conversationId) {
      return { success: false, error: "Missing conversationId" };
    }

    client.leave(`conversation:${body.conversationId}`);

    this.logger.debug("Client left conversation", {
      userId: client.data.userId,
      conversationId: body.conversationId,
    });

    return { success: true };
  }

  /**
   * TODO v1.1: Heartbeat para manter conexão viva
   *
   * Implementação:
   * - Server envia ping a cada 30s
   * - Client responde com pong
   * - Se não receber pong em 5s, desconectar
   *
   * Benefício: Detectar conexões "dead" e limpar recursos
   * Evita: Chat freezado porque servidor não sabe que cliente desconectou
   */
  // @SubscribeMessage("ping")
  // pong(@ConnectedSocket() client: Socket) {
  //   return { message: "pong" };
  // }
}

