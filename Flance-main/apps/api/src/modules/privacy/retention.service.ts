import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { PrismaService } from "../../common/prisma/prisma.service";
import {
  AUDIT_LOG_RETENTION_YEARS,
  FINANCIAL_RETENTION_YEARS,
  PASSWORD_RESET_GRACE_DAYS,
  TOKEN_GRACE_DAYS,
  daysAgo,
  yearsAgo,
} from "./retention-policy";
import { isAnonymizedEmail } from "./user-anonymization";

export interface RetentionStats {
  refreshTokens: number;
  passwordResets: number;
  unusedActivationCodes: number;
  webhookEvents: number;
  auditLogsRedacted: number;
  anonymizedAccountsPurged: number;
  errors: number;
}

/**
 * Elimina dados vencidos conforme a Política de Privacidade (seção 8). Roda 1x por dia e é idempotente.
 * Cada etapa é isolada: se uma falhar, as outras continuam e o erro é registrado.
 */
@Injectable()
export class RetentionService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RetentionService.name);
  private timer: NodeJS.Timeout | null = null;

  constructor(private readonly prisma: PrismaService) {}

  onModuleInit() {
    if (process.env.RETENTION_JOB_DISABLED === "true") {
      this.logger.warn("Rotina de retenção desativada (RETENTION_JOB_DISABLED=true).");
      return;
    }
    setTimeout(() => this.runSafely(), 60_000);
    this.timer = setInterval(() => this.runSafely(), 24 * 60 * 60 * 1000);
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  private runSafely() {
    this.run().catch((error) => this.logger.error(`Falha na rotina de retenção: ${error?.message}`));
  }

  async run(now = new Date()): Promise<RetentionStats> {
    const stats: RetentionStats = {
      refreshTokens: 0, passwordResets: 0, unusedActivationCodes: 0, webhookEvents: 0,
      auditLogsRedacted: 0, anonymizedAccountsPurged: 0, errors: 0,
    };
    const step = async (name: string, fn: () => Promise<number>, key: keyof RetentionStats) => {
      try {
        stats[key] = await fn();
      } catch (error: any) {
        stats.errors++;
        this.logger.error(`Retenção (${name}) falhou: ${error?.message}`);
      }
    };

    const financialCutoff = yearsAgo(FINANCIAL_RETENTION_YEARS, now);

    // Sessões e códigos: só têm valor enquanto válidos
    await step("tokens de sessão", async () => {
      const cutoff = daysAgo(TOKEN_GRACE_DAYS, now);
      const r = await this.prisma.refreshToken.deleteMany({
        where: { OR: [{ expiresAt: { lt: cutoff } }, { revokedAt: { lt: cutoff } }] },
      });
      return r.count;
    }, "refreshTokens");

    await step("recuperação de senha", async () => {
      const r = await this.prisma.passwordReset.deleteMany({ where: { expiresAt: { lt: daysAgo(PASSWORD_RESET_GRACE_DAYS, now) } } });
      return r.count;
    }, "passwordResets");

    // Códigos USADOS ficam: provam a ativação do plano (fazem parte da prova do pagamento)
    await step("códigos de ativação não usados", async () => {
      const r = await this.prisma.paymentActivationCode.deleteMany({
        where: { usedAt: null, expiresAt: { lt: daysAgo(TOKEN_GRACE_DAYS, now) } },
      });
      return r.count;
    }, "unusedActivationCodes");

    // Linha do tempo de webhooks acompanha o prazo dos pagamentos
    await step("eventos de webhook", async () => {
      const r = await this.prisma.paymentWebhookEvent.deleteMany({ where: { receivedAt: { lt: financialCutoff } } });
      return r.count;
    }, "webhookEvents");

    // Logs de moderação guardam nome e e-mail de quem foi moderado
    await step("logs de moderação", async () => {
      const r = await this.prisma.adminAuditLog.updateMany({
        where: {
          createdAt: { lt: yearsAgo(AUDIT_LOG_RETENTION_YEARS, now) },
          NOT: { targetEmail: "[removido]" },
        },
        data: { targetEmail: "[removido]", targetName: "[removido]" },
      });
      return r.count;
    }, "auditLogsRedacted");

    // Contas anonimizadas cujo prazo de guarda financeira acabou: apaga também as provas
    await step("contas anonimizadas vencidas", () => this.purgeExpiredAnonymizedAccounts(financialCutoff), "anonymizedAccountsPurged");

    this.logger.log(`Rotina de retenção concluída: ${JSON.stringify(stats)}`);
    return stats;
  }

  private async purgeExpiredAnonymizedAccounts(cutoff: Date): Promise<number> {
    const candidates = await this.prisma.user.findMany({
      where: { email: { endsWith: "@excluido.invalid" } },
      select: { id: true, email: true },
    });

    let purged = 0;
    for (const user of candidates) {
      if (!isAnonymizedEmail(user.email)) continue;

      const [payments, acceptances, subscriptions] = await Promise.all([
        this.prisma.payment.aggregate({ where: { userId: user.id }, _max: { createdAt: true } }),
        this.prisma.contractAcceptance.aggregate({ where: { userId: user.id }, _max: { acceptedAt: true } }),
        this.prisma.subscription.aggregate({ where: { userId: user.id }, _max: { updatedAt: true } }),
      ]);
      const latest = [payments._max.createdAt, acceptances._max.acceptedAt, subscriptions._max.updatedAt]
        .filter((d): d is Date => Boolean(d))
        .sort((a, b) => b.getTime() - a.getTime())[0];

      // Sem nenhum registro financeiro (não deveria ocorrer) ou prazo vencido: pode apagar
      if (latest && latest >= cutoff) continue;

      await this.prisma.$transaction(async (tx: any) => {
        await tx.payment.deleteMany({ where: { userId: user.id } }); // códigos de ativação saem em cascata
        await tx.subscription.deleteMany({ where: { userId: user.id } });
        await tx.contractAcceptance.deleteMany({ where: { userId: user.id } });
        await tx.user.delete({ where: { id: user.id } });
      });
      purged++;
    }
    return purged;
  }
}
