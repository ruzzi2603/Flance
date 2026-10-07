import { Injectable, Logger, OnModuleInit } from "@nestjs/common";
import { PrismaService } from "../../common/prisma/prisma.service";
import { isAnonymizedEmail } from "../privacy/user-anonymization";
import { DAY_MS, getAccessDeadline } from "./billing/billing-schedule";
import { PaymentEmailService } from "./payment-email.service";
import { PaymentsService } from "./payments.service";
import { getPlanConfig } from "./plans.config";
import { SubscriptionsService } from "./subscriptions.service";

/** Quantos dias antes do vencimento avisamos o usuário */
const REMINDER_DAYS_BEFORE_DUE = 5;

@Injectable()
export class SubscriptionsCheckService implements OnModuleInit {
  private readonly logger = new Logger(SubscriptionsCheckService.name);
  private checkInterval: NodeJS.Timeout | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly paymentEmailService: PaymentEmailService,
    private readonly paymentsService: PaymentsService,
    private readonly subscriptionsService: SubscriptionsService,
  ) {}

  onModuleInit() {
    setTimeout(() => {
      this.checkAllSubscriptions().catch((err) =>
        this.logger.error(`Erro na verificação inicial de assinaturas: ${err?.message}`),
      );
    }, 10_000);

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
   * Rotina (a cada 6h). Todos os passos são idempotentes; rodar duas vezes não duplica nada.
   *  1) Cria no Asaas a cobrança mensal de assinaturas ativas que ainda não têm
   *  2) Traz do Asaas mensalidades que o webhook não entregou
   *  3) Avisa por e-mail: mensalidade perto de vencer e em atraso
   *  4) Avisa quem cancelou a renovação e está perto do fim
   *  5) Encerra o plano (volta ao FREE) após o fim do período + tolerância
   */
  async checkAllSubscriptions() {
    const now = new Date();
    this.logger.log("Iniciando rotina de verificação de assinaturas...");
    const stats = { scheduled: 0, synced: 0, reminders: 0, overdue: 0, ending: 0, expired: 0 };

    // 1) Cobrança mensal pendente de criação no Asaas
    const unscheduled = await this.prisma.subscription.findMany({
      where: { status: "ACTIVE", cancelAtPeriodEnd: false, asaasSubscriptionId: null },
      select: { id: true },
    });
    for (const sub of unscheduled) {
      try {
        if (await this.subscriptionsService.ensureRecurringBilling(sub.id)) stats.scheduled++;
      } catch (error: any) {
        this.logger.error(`Falha ao criar cobrança mensal da assinatura ${sub.id}: ${error?.message}`);
      }
    }

    // 2) Mensalidades próximas do vencimento que ainda não chegaram por webhook
    const upcoming = await this.prisma.subscription.findMany({
      where: {
        status: "ACTIVE",
        cancelAtPeriodEnd: false,
        asaasSubscriptionId: { not: null },
        nextDueDate: { lte: new Date(now.getTime() + 12 * DAY_MS) },
      },
    });
    for (const sub of upcoming) {
      try {
        stats.synced += (await this.paymentsService.syncSubscriptionInvoices(sub)).length;
      } catch (error: any) {
        this.logger.warn(`Falha ao sincronizar mensalidades da assinatura ${sub.id}: ${error?.message}`);
      }
    }

    // 3) Lembretes e atraso (um aviso de cada tipo por mensalidade)
    const invoices = await this.prisma.payment.findMany({
      where: {
        kind: "RECURRING",
        status: { in: ["PENDING", "EXPIRED"] },
        dueDate: { not: null, lte: new Date(now.getTime() + REMINDER_DAYS_BEFORE_DUE * DAY_MS) },
        subscription: { status: "ACTIVE", cancelAtPeriodEnd: false },
      },
      include: { user: true },
    });
    for (const invoice of invoices) {
      if (!invoice.dueDate) continue;
      const isOverdue = invoice.dueDate <= now;
      const alreadyNotified = isOverdue ? invoice.overdueNoticeSentAt : invoice.reminderSentAt;
      if (alreadyNotified) continue;

      // "Reserva" o envio antes de mandar o e-mail para duas rotinas não enviarem em duplicidade
      const claim = await this.prisma.payment.updateMany({
        where: { id: invoice.id, ...(isOverdue ? { overdueNoticeSentAt: null } : { reminderSentAt: null }) },
        data: isOverdue ? { overdueNoticeSentAt: now } : { reminderSentAt: now },
      });
      if (claim.count !== 1) continue;

      const sent = await this.paymentEmailService.sendInvoiceEmail({
        to: invoice.user.email,
        userName: invoice.user.name,
        planName: getPlanConfig(invoice.plan).name,
        amount: Number(invoice.amount),
        dueDate: invoice.dueDate,
        paymentId: invoice.id,
        variant: isOverdue ? "overdue" : "reminder",
      });
      if (!sent) {
        // SMTP falhou: libera para tentar de novo na próxima rotina
        await this.prisma.payment.update({
          where: { id: invoice.id },
          data: isOverdue ? { overdueNoticeSentAt: null } : { reminderSentAt: null },
        });
      } else if (isOverdue) stats.overdue++;
      else stats.reminders++;
    }

    // 4) Renovação cancelada: avisa 3 dias antes de acabar
    const ending = await this.prisma.subscription.findMany({
      where: {
        status: "ACTIVE",
        cancelAtPeriodEnd: true,
        renewalReminderSentAt: null,
        expiresAt: { gt: now, lte: new Date(now.getTime() + 3 * DAY_MS) },
      },
      include: { user: true },
    });
    for (const sub of ending) {
      if (!sub.expiresAt) continue;
      await this.prisma.subscription.update({ where: { id: sub.id }, data: { renewalReminderSentAt: now } });
      await this.paymentEmailService.sendSubscriptionEndEmail({
        to: sub.user.email,
        userName: sub.user.name,
        planName: getPlanConfig(sub.plan).name,
        endsAt: sub.expiresAt,
        ended: false,
      });
      stats.ending++;
    }

    // 5) Encerramento (fim do período + tolerância; cancelada: sem tolerância)
    const candidates = await this.prisma.subscription.findMany({
      where: { status: "ACTIVE", expiresAt: { lte: now } },
      include: { user: true },
    });
    for (const sub of candidates) {
      if (!sub.expiresAt) continue;
      const deadline = sub.cancelAtPeriodEnd ? sub.expiresAt : getAccessDeadline(sub.expiresAt);
      if (deadline > now) continue;
      if (await this.subscriptionsService.expireSubscription(sub)) {
        stats.expired++;
        if (isAnonymizedEmail(sub.user.email)) continue; // conta excluída: sem e-mail
        await this.paymentEmailService.sendSubscriptionEndEmail({
          to: sub.user.email,
          userName: sub.user.name,
          planName: getPlanConfig(sub.plan).name,
          endsAt: sub.expiresAt,
          ended: true,
        });
      }
    }

    this.logger.log(`Rotina concluída: ${JSON.stringify(stats)}`);
    return stats;
  }
}
