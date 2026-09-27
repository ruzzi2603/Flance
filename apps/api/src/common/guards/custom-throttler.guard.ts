/**
 * CUSTOM THROTTLER GUARD - Rate Limiting avançado
 * Propósito: Proteção contra brute force, spam de propostas, scraping
 *
 * Estratégia:
 * - Rate limit global: 60 req/min (padrão)
 * - Rate limit LOGIN: 5 tentativas/min por IP
 * - Rate limit PROPOSALS: 10 propostas/min por user
 * - Rate limit MESSAGES: 30 mensagens/min por user
 *
 * IMPORTANTE: Em produção, usar armazenamento em Redis para distribuído
 */

import { Injectable } from "@nestjs/common";
import { ThrottlerGuard } from "@nestjs/throttler";
import { ExecutionContext } from "@nestjs/common";

@Injectable()
export class CustomThrottlerGuard extends ThrottlerGuard {
  /**
   * Key generation customizado
   * Usa userId se autenticado, senão IP do cliente
   *
   * Exemplos:
   * - GET /jobs → "throttle:global:192.168.1.1"
   * - POST /auth/login → "throttle:login:192.168.1.1"
   * - POST /proposals → "throttle:proposals:user-123"
   */
  async getTracker(req: any): Promise<string> {
    // Recuperar endpoint para determinar limite específico
    const path = req.path;
    const method = req.method;

    // Acessar que tipo de rate limit aplicar
    let limitName = "default";

    if (method === "POST" && path.includes("/auth/login")) {
      limitName = "login";
    } else if (method === "POST" && path.includes("/auth/register")) {
      limitName = "register";
    } else if (method === "POST" && path.includes("/proposals")) {
      limitName = "proposals";
    } else if (method === "POST" && path.includes("/conversations") && path.includes("/messages")) {
      limitName = "messages";
    }

    // Usar userId se autenticado (user), senão IP
    const identifier = req.user?.id || req.ip || req.connection.remoteAddress || "unknown";

    return `throttle:${limitName}:${identifier}`;
  }

}
