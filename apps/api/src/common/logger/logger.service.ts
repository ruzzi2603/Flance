/**
 * LOGGER SERVICE - Structured Logging com Winston
 * Propósito: Centralizar logs estruturados para produção, facilitar debugging e monitoramento
 *
 * Features:
 * - Logs em arquivo e console (dev)
 * - Contexto de request (correlationId, userId)
 * - Severidade (debug, info, warn, error)
 * - JSON format para agregação em prod
 */

import { Injectable, LoggerService as NestLoggerService } from "@nestjs/common";
import * as winston from "winston";

export interface LogContext {
  userId?: string;
  correlationId?: string;
  requestId?: string;
  duration?: number;
  [key: string]: unknown;
}

@Injectable()
export class LoggerService implements NestLoggerService {
  private logger: winston.Logger;
  private context: LogContext = {};

  constructor() {
    const isDev = process.env.NODE_ENV !== "production";

    this.logger = winston.createLogger({
      level: isDev ? "debug" : "info",
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.errors({ stack: true }),
        isDev
          ? winston.format.printf(({ timestamp, level, message, context, ...meta }) => {
              const ctx = context ? ` [${JSON.stringify(context)}]` : "";
              return `${timestamp} [${level.toUpperCase()}]${ctx}: ${message}${Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : ""}`;
            })
          : winston.format.json(),
      ),
      defaultMeta: { service: "flance-api" },
      transports: [
        // Console em dev, arquivo em prod
        isDev
          ? new winston.transports.Console()
          : new winston.transports.File({
              filename: "logs/error.log",
              level: "error",
              maxsize: 5242880, // 5MB
              maxFiles: 5,
            }),
        !isDev && new winston.transports.File({ filename: "logs/combined.log", maxsize: 5242880, maxFiles: 5 }),
      ].filter(Boolean) as winston.transport[],
    });
  }

  /**
   * Define contexto para logs subsequentes (userId, correlationId, etc)
   */
  setContext(context: LogContext) {
    this.context = { ...this.context, ...context };
  }

  /**
   * Reset contexto (chamar ao fim de request)
   */
  clearContext() {
    this.context = {};
  }

  /**
   * Logs de informação (eventos normais)
   * Exemplo: "User login successful", "Job created"
   */
  info(message: string, meta?: Record<string, unknown>) {
    this.logger.info(message, { context: this.context, ...meta });
  }

  /**
   * Logs de debug (desenvolvimento)
   * Exemplo: "Database query", "Cache hit/miss"
   */
  debug(message: string, meta?: Record<string, unknown>) {
    this.logger.debug(message, { context: this.context, ...meta });
  }

  /**
   * Logs de aviso (comportamento inesperado mas recuperável)
   * Exemplo: "Rate limit exceeded", "Weak password attempt"
   */
  warn(message: string, meta?: Record<string, unknown>) {
    this.logger.warn(message, { context: this.context, ...meta });
  }

  /**
   * Logs de erro (falhas que afetam funcionalidade)
   * Exemplo: "Database connection failed", "Email send failed"
   * IMPORTANTE: Nunca logar senhas, tokens ou dados sensíveis!
   */
  error(message: string, error?: Error | unknown, meta?: Record<string, unknown>) {
    const errorMeta = error instanceof Error ? { stack: error.stack, message: error.message } : { error };
    this.logger.error(message, {
      context: this.context,
      ...errorMeta,
      ...meta,
    });
  }

  /**
   * Logs de erro crítico (aplicação pode crashear)
   * Exemplo: "Database connection lost", "Out of memory"
   */
  fatal(message: string, error?: Error | unknown, meta?: Record<string, unknown>) {
    const errorMeta = error instanceof Error ? { stack: error.stack, message: error.message } : { error };
    this.logger.error(`[FATAL] ${message}`, {
      context: this.context,
      ...errorMeta,
      ...meta,
    });
  }

  /**
   * NestJS LoggerService interface - maps to info()
   */
  log(message: string, context?: string) {
    this.logger.info(message, { context: context || this.context });
  }

  /**
   * NestJS LoggerService interface - verbose logging
   */
  verbose(message: string, context?: string) {
    this.logger.debug(message, { context: context || this.context });
  }
}
