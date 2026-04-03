/**
 * BOOTSTRAP - Inicialização da API Flance
 *
 * Responsabilidades (em ordem):
 * 1. Carregamento de variáveis de ambiente (.env, .env.local)
 * 2. Validação de configuração
 * 3. Inicialização de Logger
 * 4. Setup de segurança (Helmet, CORS, CSRF)
 * 5. Setup de middleware (logging, parsing)
 * 6. Setup de exception handlers
 * 7. Listen na porta
 *
 * IMPORTANTE: Cada etapa valida seus pré-requisitos (fail fast principle)
 */

import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { NestExpressApplication } from "@nestjs/platform-express";
import { config as loadDotenv } from "dotenv";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import cookieParser from "cookie-parser";
import helmet from "helmet";
import { AppModule } from "./app.module";
import { validateEnv } from "./config/env.validation";
import { AllExceptionsFilter, HttpExceptionFilter } from "./common/filters/all-exceptions.filter";
import { LoggerService } from "./common/logger/logger.service";
import type { Request, Response, NextFunction } from "express";

/**
 * Carrega .env da raiz do monorepo ou do app específico
 * Ordem de precedência: .env > .env.local > ../../.env > ../../.env.local
 *
 * Útil para:
 * - Dev local: use .env.local
 * - CI/CD: injeta via variáveis de ambiente
 * - Produção: gerenciado por plataforma de hospedagem
 */
function loadEnvFiles() {
  const candidates = [
    resolve(process.cwd(), ".env"),
    resolve(process.cwd(), ".env.local"),
    resolve(process.cwd(), "../../.env"),
    resolve(process.cwd(), "../../.env.local"),
  ];

  for (const envPath of candidates) {
    if (existsSync(envPath)) {
      loadDotenv({ path: envPath, override: false });
    }
  }
}

/**
 * Bootstrap principal
 * Inicializa toda a aplicação cum infraestrutura robusta
 */
async function bootstrap() {
  // === 1. CARREGAR ENV ===
  loadEnvFiles();
  const env = validateEnv(process.env);

  // === 2. CRIAR APP ===
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    bufferLogs: true, // Esperar logger estar pronto
  });

  // === 3. SETUP LOGGER ===
  const loggerService = app.get(LoggerService);
  app.useLogger(loggerService);

  loggerService.info("🚀 Flance API iniciando", {
    environment: env.NODE_ENV,
    port: env.PORT,
  });

  // === 4. CONFIGURAR PREFIXO DE ROTA ===
  app.setGlobalPrefix("v1");

  // === 5. SECURITY - HELMET ===
  // Helmet adiciona headers HTTP seguros (X-Frame-Options, X-Content-Type-Options, etc)
  // Ref: https://helmetjs.github.io/
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          scriptSrc: ["'self'"],
          imgSrc: ["'self'", "data:", "https:"],
        },
      },
      // Desabilitar HSTS em dev (localhost use http)
      hsts: env.NODE_ENV === "production" ? { maxAge: 31536000, includeSubDomains: true, preload: true } : false,
    }),
  );

  // === 6. PARSING - Body, Cookies ===
  app.use(cookieParser());
  app.useBodyParser("json", { limit: "5mb", type: ["application/json", "application/*+json", "*/*"] });
  app.useBodyParser("urlencoded", { extended: true, limit: "5mb" });

  // === 7. MIDDLEWARE - Request Logging ===
  // IMPORTANTE: Deve estar DEPOIS dos body parsers, ANTES dos routes
  // Middleware é registrado em AppModule.configure()

  // === 8. CORS - Cross-Origin ===
  // IMPORTANTE: Em produção, CORS_ORIGIN deve ser URL específica (não * wildcard)
  // Exemplos:
  // - Dev: http://localhost:3000
  // - Prod: https://flance.com
  // - Staging: https://staging.flance.com
  app.enableCors({
    origin: env.CORS_ORIGIN,
    credentials: true, // Permitir cookies em requisições cross-origin
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "X-Correlation-Id"],
    maxAge: 3600, // 1 hora - preflight cache
  });

  // === 9. EXCEPTION FILTERS - Error Handling ===
  // Ordem importa: mais específico primeiro
  app.useGlobalFilters(
    new HttpExceptionFilter(loggerService), // HTTP exceptions (4xx, 5xx)
    new AllExceptionsFilter(loggerService), // Todas as outras exceções
  );

  // === 10. DESENVOLVIMENTO - Debug Logging ===
  // Logar payloads de POST /jobs em desenvolvimento para debugging
  if (env.NODE_ENV !== "production") {
    app.use((req: Request, _res: Response, next: NextFunction) => {
      if (req.method === "POST" && req.path === "/v1/jobs") {
        loggerService.debug("[DEV] POST /jobs payload", {
          contentType: req.headers["content-type"],
          bodySize: JSON.stringify(req.body).length,
        });
      }
      next();
    });
  }

  // === 11. LISTEN ===
  await app.listen(env.PORT);

  loggerService.info(`✅ Flance API rodando na porta ${env.PORT}`, {
    baseUrl: `http://localhost:${env.PORT}/v1`,
    corsOrigin: env.CORS_ORIGIN,
  });
}

/**
 * Executar bootstrap
 * Usar void para indicar que promise é intencional não-awaited
 */
void bootstrap().catch((error) => {
  // eslint-disable-next-line no-console
  console.error("[FATAL] Bootstrap failed:", error);
  process.exit(1);
});


