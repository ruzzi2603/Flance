/**
 * APP MODULE - Raiz de todos os módulos
 *
 * Importações críticas:
 * 1. Logger - Structured logging
 * 2. Throttler - Rate limiting avançado
 * 3. Prisma - ORM & Database
 * 4. Auth - JWT & Autenticação
 * 5. Domain modules - Negócio (Users, Jobs, Proposals, Chat, Payments, AI)
 *
 * Guards & Filters globais:
 * - CustomThrottlerGuard: Rate limiting por endpoint/user
 * - Exception Filters: Tratamento centralizado de erros
 */

import { Module, MiddlewareConsumer, NestModule } from "@nestjs/common";
import { ThrottlerModule } from "@nestjs/throttler";
import { APP_GUARD } from "@nestjs/core";
import { AiModule } from "./modules/ai/ai.module";
import { AuthModule } from "./modules/auth/auth.module";
import { JobsModule } from "./modules/jobs/jobs.module";
import { PaymentsModule } from "./modules/payments/payments.module";
import { UsersModule } from "./modules/users/users.module";
import { AppController } from "./app.controller";
import { PrismaModule } from "./common/prisma/prisma.module";
import { ProposalsModule } from "./modules/proposals/proposals.module";
import { ChatModule } from "./modules/chat/chat.module";
import { LoggerModule } from "./common/logger/logger.module";
import { CustomThrottlerGuard } from "./common/guards/custom-throttler.guard";
import { RequestLoggerMiddleware } from "./common/middleware/request-logger.middleware";

@Module({
  controllers: [AppController],
  imports: [
    /**
     * LOGGER - Infraestrutura de logging estruturado
     * Importado primeiro para estar disponível em todos os módulos
     */
    LoggerModule,

    /**
     * THROTTLER (Rate Limiting)
     * Configuração base - limites específicos em CustomThrottlerGuard
     *
     * Estratégia:
     * - Global: 60 req/min
     * - Login: 5 tentativas/min
     * - Register: 3/min
     * - Proposals: 10/min
     * - Messages: 30/min per user
     *
     * IMPORTANTE: Em produção, usar Redis para distribuição em múltiplas instâncias
     * Referência: https://docs.nestjs.com/security/rate-limiting
     */
    ThrottlerModule.forRoot([
      {
        name: "default",
        ttl: 60_000,
        limit: 60,
      },
    ]),

    /**
     * DATABASE - Prisma ORM
     * Conexão com PostgreSQL, migrations, schema
     */
    PrismaModule,

    /**
     * AUTH - Autenticação & Autorização
     * JWT tokens, password reset, refresh tokens
     * Deve estar importado ANTES dos módulos que dependem
     */
    AuthModule,

    /**
     * DOMAIN MODULES
     * Ordem não importa, mas manter organizado por responsabilidade
     */
    UsersModule,
    JobsModule,
    ProposalsModule,
    PaymentsModule,
    AiModule,
    ChatModule,
  ],
  providers: [
    /**
     * GLOBAL GUARDS - Rate Limiting
     * Aplica CustomThrottlerGuard a TODOS os endpoints
     *
     * Alternativa: Aplicar por controller/route com @UseGuards()
     * Benefício global: Protege toda API por padrão, permite override
     */
    {
      provide: APP_GUARD,
      useClass: CustomThrottlerGuard,
    },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(RequestLoggerMiddleware).forRoutes("*");
  }
}

