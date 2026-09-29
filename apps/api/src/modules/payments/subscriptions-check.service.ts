import { Injectable, Logger, OnModuleInit } from "@nestjs/common";
import { PrismaService } from "../../common/prisma/prisma.service";
import { PaymentEmailService } from "./payment-email.service";
import { getPlanConfig } from "./plans.config";

@Injectable()
export class SubscriptionsCheckService implements OnModuleInit {
  private readonly logger = new Logger(SubscriptionsCheckService.name);
  private checkInterval: NodeJS.Timeout | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly paymentEmailService: PaymentEmailService,
  ) {}

  onModuleInit() {
    // Executa verificação inicial após 10 segundos do startup
    setTimeout(() => {
      this.checkAllSubscriptions().catch((err) =>
        this.logger.error(`Erro na verificação inicial de assinaturas: ${err?.message}`),
      );
    }, 10_000);

    // Agenda verificação a cada 6 horas
    this.checkInterval = setInterval(
      () => {
        this.checkAllSubscriptions().catch((err) =>
          this.logger.error(`Erro na verificação periódica de assinaturas: ${err?.message}`),
        );
      },
      6 * 60 * 60 * 1000,
    );
  }

  /**
   * Executa varredura de expiração e avisos de renovação (Regras 25, 26, 27)
   */
  async checkAllSubscriptions() {
    const now = new Date();
    this.logger.log("Iniciando rotina de verificação de assinaturas...");

    // 1. Expira assinaturas vencidas (Regra 27)
    const expiredSubscriptions = await this.prisma.subscription.findMany({
      where: {
        status: "ACTIVE",
        expiresAt: { lte: now },
      },
      include: { user: true },
    });

    for (const sub of expiredSubscriptions) {
      await this.prisma.subscription.update({
        where: { id: sub.id },
        data: { status: "EXPIRED" },
      });

      // Retorna usuário ao plano FREE sem apagar dados (Regra 27 e 28)
      await this.prisma.user.update({
        where: { id: sub.userId },
        data: { planTier: "FREE" },
      });

      this.logger.log(`Assinatura ${sub.id} do usuário ${sub.userId} foi expirada.`);
    }

    // 2. Dispara aviso de 3 dias para assinaturas próximas ao vencimento (Regras 25 e 26)
    const threeDaysAhead = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);
    const expiringSoonSubscriptions = await this.prisma.subscription.findMany({
      where: {
        status: "ACTIVE",
        expiresAt: {
          gt: now,
          lte: threeDaysAhead,
        },
        renewalReminderSentAt: null, // Evita spam (Regra 26)
      },
      include: { user: true },
    });

    for (const sub of expiringSoonSubscriptions) {
      if (!sub.expiresAt) continue;

      const diffMs = sub.expiresAt.getTime() - now.getTime();
      const daysRemaining = Math.max(1, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));

      await this.prisma.subscription.update({
        where: { id: sub.id },
        data: { renewalReminderSentAt: now },
      });

      const planConfig = getPlanConfig(sub.plan);
      await this.paymentEmailService.sendRenewalReminderEmail({
        to: sub.user.email,
        userName: sub.user.name,
        planName: planConfig.name,
        daysRemaining,
        expiresAtDateString: sub.expiresAt.toLocaleDateString("pt-BR"),
      });

      this.logger.log(
        `Aviso de 3 dias enviado para o usuário ${sub.userId} (${sub.user.email}). Dias restantes: ${daysRemaining}`,
      );
    }

    this.logger.log(
      `Rotina concluída. Expiradas: ${expiredSubscriptions.length}, Avisos enviados: ${expiringSoonSubscriptions.length}.`,
    );
  }
}
