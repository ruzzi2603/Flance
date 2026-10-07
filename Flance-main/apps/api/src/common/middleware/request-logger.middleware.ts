/**
 * REQUEST LOGGER MIDDLEWARE - Logging automático de requisições
 * Propósito: Rastrear requisições com CorrelationId, medir performance, detectar problemas
 *
 * Benefícios:
 * - CorrelationId para rastrear requisição em logs distribuídos
 * - Tempo de resposta (ms)
 * - Detecção de requests lentos
 * - Audit logging implícito
 */

import { Injectable, NestMiddleware } from "@nestjs/common";
import { Request, Response, NextFunction } from "express";
import { randomUUID } from "crypto";
import { LoggerService } from "../logger/logger.service";

@Injectable()
export class RequestLoggerMiddleware implements NestMiddleware {
  constructor(private logger: LoggerService) {}

  use(req: Request, res: Response, next: NextFunction) {
    // Gerar CorrelationId único para rastrear requisição
    const correlationId = req.header("x-correlation-id") || randomUUID();
    (req as any).correlationId = correlationId;

    // Registrar contexto do usuário (se autenticado)
    const userId = (req as any).user?.id;
    if (userId) {
      this.logger.setContext({ userId, correlationId });
    } else {
      this.logger.setContext({ correlationId });
    }

    // Medir tempo de início
    const startTime = Date.now();
    const originalSend = res.send;
    const logger = this.logger;

    // Interceptar envio de resposta
    res.send = ((data: any) => {
      const duration = Date.now() - startTime;
      const statusCode = res.statusCode;

      // Log com severidade baseada no status code
      const message = `${req.method} ${req.path}`;

      if (statusCode >= 500) {
        logger.error(`${message} - ${statusCode}`, undefined, {
          statusCode,
          duration,
          correlationId,
        });
      } else if (statusCode >= 400) {
        logger.warn(`${message} - ${statusCode}`, { statusCode, duration, correlationId });
      } else {
        // Logs de sucesso apenas em debug ou se resposta lenta (> 500ms)
        if (duration > 500 || process.env.NODE_ENV !== "production") {
          logger.debug(`${message} - ${statusCode}`, { statusCode, duration, correlationId });
        }
      }

      // IMPORTANTE: Log para detecção de queries lentas/N+1
      if (duration > 1000) {
        logger.warn(`[SLOW REQUEST] ${message}`, { duration, statusCode, correlationId });
      }

      res.send = originalSend;
      return res.send(data);
    }) as any;

    next();
  }
}
