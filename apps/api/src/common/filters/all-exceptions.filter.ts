/**
 * EXCEPTION FILTER - Tratamento centralizado de erros
 * Propósito: Consistência de resposta de erro em toda API, logging automático
 *
 * Benefícios:
 * - Respostas padronizadas (status, message, timestamp)
 * - Logging automático de erros
 * - Não expõe stack trace em produção
 * - Facilita monitoramento e debugging
 */

import { ExceptionFilter, Catch, ArgumentsHost, HttpException, HttpStatus } from "@nestjs/common";
import { Response } from "express";
import { LoggerService } from "../logger/logger.service";
import type { Request } from "express";

interface ErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    statusCode: number;
    timestamp: string;
    path?: string;
    correlationId?: string;
    /** Stack trace apenas em desenvolvimento */
    stack?: string;
  };
}

/**
 * Catch HTTP exceptions (4xx, 5xx)
 * Exemplo: NotFoundException, BadRequestException, ForbiddenException
 */
@Catch(HttpException)
export class HttpExceptionFilter implements ExceptionFilter<HttpException> {
  constructor(private logger: LoggerService) {}

  catch(exception: HttpException, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();
    const status = exception.getStatus();

    // Recuperar correlationId do request (adicionado em middleware)
    const correlationId = (request as any).correlationId;

    const errorResponse: ErrorResponse = {
      success: false,
      error: {
        code: `HTTP_${status}`,
        message: exception.message || "Internal Server Error",
        statusCode: status,
        timestamp: new Date().toISOString(),
        path: request.url,
        correlationId,
      },
    };

    // Stack trace apenas em desenvolvimento
    if (process.env.NODE_ENV !== "production") {
      errorResponse.error.stack = exception.stack;
    }

    // Log com contexto
    const logLevel = status >= 500 ? "error" : status >= 400 ? "warn" : "info";
    const logFn = this.logger[logLevel] ? this.logger[logLevel].bind(this.logger) : this.logger.info.bind(this.logger);

    logFn(`HTTP Exception: ${request.method} ${request.url}`, {
      statusCode: status,
      message: exception.message,
      path: request.url,
    });

    response.status(status).json(errorResponse);
  }
}

/**
 * Catch exceções não-HTTP (runtime errors, validation errors, etc)
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  constructor(private logger: LoggerService) {}

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();
    const correlationId = (request as any).correlationId;

    // Determinar status HTTP adequado
    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = "Internal Server Error";
    let code = "INTERNAL_ERROR";

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      message = exception.message;
      code = `HTTP_${status}`;
    } else if (exception instanceof Error) {
      // Tentar mapear erro específico
      if (exception.message.includes("Validation failed")) {
        status = HttpStatus.BAD_REQUEST;
        code = "VALIDATION_ERROR";
        message = exception.message;
      }
      // Adicione mais mapeamentos conforme necessário
    }

    // IMPORTANTE: Nunca enviar stack trace em produção!
    const errorResponse: ErrorResponse = {
      success: false,
      error: {
        code,
        message,
        statusCode: status,
        timestamp: new Date().toISOString(),
        path: request.url,
        correlationId,
        ...(process.env.NODE_ENV !== "production" && {
          stack: exception instanceof Error ? exception.stack : String(exception),
        }),
      },
    };

    // Log com severidade apropriada
    if (status >= 500) {
      this.logger.error(
        `Unhandled Exception: ${request.method} ${request.url}`,
        exception instanceof Error ? exception : new Error(String(exception)),
        { statusCode: status, path: request.url },
      );
    } else {
      this.logger.warn(`Client Error: ${request.method} ${request.url}`, { statusCode: status });
    }

    response.status(status).json(errorResponse);
  }
}
