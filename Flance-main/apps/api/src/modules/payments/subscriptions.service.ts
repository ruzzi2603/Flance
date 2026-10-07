import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
  NotFoundException,
} from "@nestjs/common";
import { timingSafeEqual } from "crypto";
import { PrismaService } from "../../common/prisma/prisma.service";
import { AsaasService } from "./asaas.service";
import { PaymentEmailService } from "./payment-email.service";
import {
  addBillingMonth,
  computeAnchorDay,
  DAY_MS,
  getAccessDeadline,
  OPEN_INVOICE_DISPLAY_DAYS,
  toAsaasDate,
} from "./billing/billing-schedule";
import { PaymentsService } from "./payments.service";
import {
  getPlanConfig,
  normalizePlanKey,
  PlanKey,
  toPrismaPlanTier,
} from "./plans.config";
import type {
  ActivateSubscriptionInput,
  RenewSubscriptionInput,
} from "./schemas/payment.schema";

@Injectable()
export class SubscriptionsService {
  private readonly logger = new Logger(SubscriptionsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly paymentsService: PaymentsService,
    private readonly paymentEmailService: PaymentEmailService,
    private readonly asaasService: AsaasService,
  ) {}

  /**
   * Ativa plano após validação do código de 6 dígitos enviado por e-mail (Regras 18, 19, 21, 22, 24)
   */
  async activateSubscription(userId: string, input: ActivateSubscriptionInput) {
    const { paymentId, code } = input;
    const now = new Date();
    const result = await this.prisma.$transaction(async (transaction) => {
      const payment = await transaction.payment.findUnique({
        where: { id: paymentId },
        include: { activationCode: true },
      });
      if (!payment) throw new NotFoundException("Pagamento não encontrado.");
      if (payment.userId !== userId) throw new ForbiddenException("Este pagamento pertence a outro usuário.");
      if (payment.status !== "PAID") throw new BadRequestException("O pagamento ainda não foi confirmado. Aguarde a compensação do Pix.");

      const activation = payment.activationCode;
      if (!activation) throw new BadRequestException("Código de ativação não encontrado para este pagamento.");
      if (activation.usedAt) throw new BadRequestException("Este código de ativação já foi utilizado.");
      if (activation.expiresAt <= now) throw new BadRequestException("Este código de ativação expirou. Solicite um novo código.");
      if (activation.attempts >= 5) {
        return { error: "attempts" as const };
      }

      const computedHash = this.paymentsService.hashCode(userId, paymentId, code);
      const computedBuffer = Buffer.from(computedHash, "hex");
      const storedBuffer = Buffer.from(activation.codeHash, "hex");
      if (computedBuffer.length !== storedBuffer.length || !timingSafeEqual(computedBuffer, storedBuffer)) {
        await transaction.paymentActivationCode.updateMany({
          where: { id: activation.id, usedAt: null, attempts: { lt: 5 } },
          data: { attempts: { increment: 1 } },
        });
        return { error: "invalid" as const };
      }

      const codeClaim = await transaction.paymentActivationCode.updateMany({
        where: { id: activation.id, usedAt: null, attempts: { lt: 5 }, expiresAt: { gt: now }, codeHash: computedHash },
        data: { usedAt: now },
      });
      if (codeClaim.count !== 1) return { error: "used" as const };

      const existingSubscription = await transaction.subscription.findFirst({
        where: { userId, status: "ACTIVE", expiresAt: { gt: now } },
        orderBy: { expiresAt: "desc" },
      });
      const planConfig = getPlanConfig(payment.plan);

      // O plano vale 1 mês a partir da ATIVAÇÃO (quem demora para digitar o código não perde dias) e
      // renova todo mês nesse mesmo dia (de 1 a 28).
      const anchorDay = computeAnchorDay(now);
      const firstRenewal = addBillingMonth(now, anchorDay);
      const startedAt = existingSubscription?.startedAt ?? now;
      const expiresAt =
        existingSubscription?.expiresAt && existingSubscription.expiresAt > firstRenewal
          ? existingSubscription.expiresAt
          : firstRenewal;

      const subscription = existingSubscription
        ? await transaction.subscription.update({
            where: { id: existingSubscription.id },
            data: { plan: payment.plan, status: "ACTIVE", expiresAt, nextDueDate: expiresAt, renewalReminderSentAt: null },
          })
        : await transaction.subscription.create({
            data: {
              userId,
              plan: payment.plan,
              status: "ACTIVE",
              startedAt,
              expiresAt,
              nextDueDate: expiresAt,
              billingAnchorDay: anchorDay,
              recurringAmount: planConfig.price,
              renewalReminderSentAt: null,
            },
          });

      await transaction.payment.update({ where: { id: payment.id }, data: { subscriptionId: subscription.id } });
      // Plano pago ativo = empresa publicada (o perfil salva companyEnabled=false até a ativação)
      await transaction.user.update({
        where: { id: userId },
        data: { planTier: payment.plan, planStartedAt: startedAt, planRenewsAt: expiresAt, companyEnabled: true },
      });
      return { subscription, startedAt, expiresAt, plan: payment.plan };
    });

    if ("error" in result) {
      if (result.error === "attempts") {
        throw new HttpException("Excesso de tentativas incorretas. Este código foi bloqueado por segurança.", HttpStatus.TOO_MANY_REQUESTS);
      }
      if (result.error === "invalid") throw new BadRequestException("Código de ativação inválido. Verifique os números informados.");
      throw new BadRequestException("Este código de ativação já foi utilizado ou expirou.");
    }

    // Agenda a cobrança mensal no Asaas. Falha aqui NÃO desfaz a ativação: a rotina diária tenta de novo.
    let autoRenew = false;
    try {
      autoRenew = await this.ensureRecurringBilling(result.subscription.id);
    } catch (error: any) {
      this.logger.error(`Assinatura ${result.subscription.id} ativada, mas a cobrança mensal falhou: ${error?.message}`);
    }

    const planConfig = getPlanConfig(result.plan);
    return {
      success: true,
      autoRenew,
      message: `Plano ${planConfig.name} ativado com sucesso! Válido até ${result.expiresAt.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" })}.`,
      subscription: {
        id: result.subscription.id,
        plan: result.subscription.plan,
        status: result.subscription.status,
        startedAt: result.startedAt.toISOString(),
        expiresAt: result.expiresAt.toISOString(),
      },
    };
  }

  /**
   * Cria a assinatura mensal no Asaas (vencimento = fim do período já pago). Idempotente e com trava
   * para que ativação e rotina diária não criem duas assinaturas.
   */
  async ensureRecurringBilling(subscriptionId: string): Promise<boolean> {
    const now = new Date();
    const subscription = await this.prisma.subscription.findUnique({
      where: { id: subscriptionId },
      include: { user: { select: { asaasCustomerId: true } } },
    });
    if (
      !subscription ||
      subscription.status !== "ACTIVE" ||
      subscription.cancelAtPeriodEnd ||
      subscription.asaasSubscriptionId ||
      !subscription.expiresAt
    ) {
      return Boolean(subscription?.asaasSubscriptionId);
    }
    if (!subscription.user.asaasCustomerId) {
      this.logger.warn(`Assinatura ${subscription.id} sem cliente Asaas; cobrança mensal não criada.`);
      return false;
    }

    const lock = await this.prisma.subscription.updateMany({
      where: {
        id: subscription.id,
        asaasSubscriptionId: null,
        OR: [{ billingSyncLockedAt: null }, { billingSyncLockedAt: { lt: new Date(now.getTime() - 2 * 60 * 1000) } }],
      },
      data: { billingSyncLockedAt: now },
    });
    if (lock.count !== 1) return false;

    try {
      const planConfig = getPlanConfig(subscription.plan);
      const dueDate =
        subscription.expiresAt > now ? subscription.expiresAt : addBillingMonth(now, subscription.billingAnchorDay);
      const remote = await this.asaasService.createSubscription({
        customerId: subscription.user.asaasCustomerId,
        value: planConfig.price,
        nextDueDate: toAsaasDate(dueDate),
        description: `Assinatura Flance - Plano ${planConfig.name} (mensalidade)`,
        externalReference: subscription.id,
      });
      await this.prisma.subscription.update({
        where: { id: subscription.id },
        data: {
          asaasSubscriptionId: remote.id,
          nextDueDate: dueDate,
          recurringAmount: planConfig.price,
          billingSyncLockedAt: null,
        },
      });
      this.logger.log(`Cobrança mensal criada. Subscription=${subscription.id} Asaas=${remote.id} vencimento=${toAsaasDate(dueDate)}`);

      // O Asaas gera a 1ª cobrança já na criação e dispara o webhook na hora, possivelmente antes de
      // gravarmos o id da assinatura acima (webhook ignorado). Busca agora o que já foi gerado.
      try {
        await this.paymentsService.syncSubscriptionInvoices({ ...subscription, asaasSubscriptionId: remote.id });
      } catch (error: any) {
        this.logger.warn(`Cobranças iniciais serão sincronizadas pela rotina: ${error?.message}`);
      }
      return true;
    } catch (error) {
      await this.prisma.subscription.update({ where: { id: subscription.id }, data: { billingSyncLockedAt: null } });
      throw error;
    }
  }

  /** Encerra o plano (fim do período + tolerância): cancela a cobrança no Asaas e volta ao FREE */
  async expireSubscription(subscription: { id: string; userId: string; asaasSubscriptionId?: string | null }) {
    if (subscription.asaasSubscriptionId) {
      try {
        await this.asaasService.deleteSubscription(subscription.asaasSubscriptionId);
      } catch (error: any) {
        this.logger.error(`Não foi possível cancelar a assinatura Asaas ${subscription.asaasSubscriptionId}: ${error?.message}`);
        return false; // tenta de novo na próxima rotina; não encerra sem cancelar a cobrança
      }
    }
    await this.paymentsService.cancelOpenRenewalInvoices(subscription.id);
    await this.prisma.subscription.update({
      where: { id: subscription.id },
      data: { status: "EXPIRED", asaasSubscriptionId: null, nextDueDate: null },
    });
    await this.prisma.user.update({ where: { id: subscription.userId }, data: { planTier: "FREE" } });
    this.logger.log(`Assinatura ${subscription.id} encerrada.`);
    return true;
  }

  private isPastAccessDeadline(subscription: { expiresAt: Date | null; cancelAtPeriodEnd: boolean }, now: Date) {
    if (!subscription.expiresAt) return false;
    // Cancelada: pagou até expiresAt, sem tolerância. Ativa: tolerância para pagar o Pix do vencimento.
    const deadline = subscription.cancelAtPeriodEnd ? subscription.expiresAt : getAccessDeadline(subscription.expiresAt);
    return deadline <= now;
  }

  /** Mensalidade em aberto (Pix a pagar). `withinDays` limita às que vencem em breve (para exibição). */
  private findOpenInvoice(userId: string, subscriptionId: string, withinDays?: number) {
    return this.prisma.payment.findFirst({
      where: {
        userId,
        subscriptionId,
        kind: "RECURRING",
        status: { in: ["PENDING", "EXPIRED"] },
        ...(withinDays ? { dueDate: { lte: new Date(Date.now() + withinDays * DAY_MS) } } : {}),
      },
      orderBy: { dueDate: "asc" },
    });
  }

  /**
   * Consulta a assinatura atual: plano, próxima renovação, mensalidade em aberto e contrato aceito.
   */
  async getMySubscription(userId: string) {
    const now = new Date();

    const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { id: true } });
    if (!user) throw new NotFoundException("Usuário não encontrado.");

    let subscription = await this.prisma.subscription.findFirst({
      where: { userId },
      orderBy: { createdAt: "desc" },
    });

    if (subscription?.status === "ACTIVE" && this.isPastAccessDeadline(subscription, now)) {
      if (await this.expireSubscription(subscription)) {
        subscription = { ...subscription, status: "EXPIRED", asaasSubscriptionId: null, nextDueDate: null };
      }
    }

    const isActive = subscription?.status === "ACTIVE";
    const renewing = Boolean(isActive && subscription && !subscription.cancelAtPeriodEnd);
    // O Asaas gera a cobrança com antecedência; só mostramos quando está perto de vencer
    let openInvoice =
      renewing && subscription ? await this.findOpenInvoice(userId, subscription.id, OPEN_INVOICE_DISPLAY_DAYS) : null;

    // Rede de segurança: perto do vencimento e sem a cobrança local, consulta o Asaas
    if (
      renewing && subscription && !openInvoice && subscription.asaasSubscriptionId &&
      subscription.nextDueDate && subscription.nextDueDate.getTime() - now.getTime() < 12 * DAY_MS
    ) {
      try {
        await this.paymentsService.syncSubscriptionInvoices(subscription);
        openInvoice = await this.findOpenInvoice(userId, subscription.id, OPEN_INVOICE_DISPLAY_DAYS);
      } catch (error: any) {
        this.logger.warn(`Não foi possível sincronizar mensalidades: ${error?.message}`);
      }
    }

    const acceptance = await this.prisma.contractAcceptance.findFirst({
      where: { userId },
      orderBy: { acceptedAt: "desc" },
      select: { contractVersion: true, acceptedAt: true },
    });

    let daysRemaining = 0;
    if (isActive && subscription?.expiresAt && subscription.expiresAt > now) {
      daysRemaining = Math.ceil((subscription.expiresAt.getTime() - now.getTime()) / DAY_MS);
    }
    const isExpiringSoon = Boolean(isActive && daysRemaining > 0 && daysRemaining <= 3);

    const currentPlanKey = isActive && subscription ? subscription.plan : PlanKey.FREE;
    const planConfig = getPlanConfig(currentPlanKey);

    return {
      hasActiveSubscription: isActive,
      plan: currentPlanKey,
      planConfig,
      subscription: subscription
        ? {
            id: subscription.id,
            plan: subscription.plan,
            status: subscription.status,
            startedAt: subscription.startedAt?.toISOString() || null,
            expiresAt: subscription.expiresAt?.toISOString() || null,
            daysRemaining,
            isExpiringSoon,
          }
        : null,
      billing: subscription
        ? {
            billingAnchorDay: subscription.billingAnchorDay,
            autoRenew: renewing,
            cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
            canceledAt: subscription.canceledAt?.toISOString() || null,
            nextDueDate: subscription.expiresAt?.toISOString() || null,
            recurringAmount: subscription.recurringAmount ? Number(subscription.recurringAmount) : planConfig.price,
            recurringScheduled: Boolean(subscription.asaasSubscriptionId),
            openInvoice: openInvoice
              ? {
                  paymentId: openInvoice.id,
                  amount: Number(openInvoice.amount),
                  dueDate: openInvoice.dueDate?.toISOString() || null,
                  overdue: Boolean(openInvoice.dueDate && openInvoice.dueDate <= now),
                }
              : null,
          }
        : null,
      contract: acceptance
        ? { version: acceptance.contractVersion, acceptedAt: acceptance.acceptedAt.toISOString() }
        : null,
    };
  }

  /** Cancela a renovação: o plano segue até o fim do período já pago e não há novas cobranças */
  async cancelRenewal(userId: string) {
    const subscription = await this.prisma.subscription.findFirst({
      where: { userId, status: "ACTIVE" },
      orderBy: { expiresAt: "desc" },
    });
    if (!subscription) throw new NotFoundException("Você não possui assinatura ativa.");
    if (subscription.cancelAtPeriodEnd) return this.getMySubscription(userId);

    // Se o Asaas recusar, não marca como cancelado: o cliente seria cobrado mesmo achando que cancelou
    if (subscription.asaasSubscriptionId) {
      await this.asaasService.deleteSubscription(subscription.asaasSubscriptionId);
    }
    await this.prisma.subscription.update({
      where: { id: subscription.id },
      data: { cancelAtPeriodEnd: true, canceledAt: new Date(), asaasSubscriptionId: null, nextDueDate: null },
    });
    await this.paymentsService.cancelOpenRenewalInvoices(subscription.id);
    this.logger.log(`Renovação da assinatura ${subscription.id} cancelada pelo usuário ${userId}.`);
    return this.getMySubscription(userId);
  }

  /** Desfaz o cancelamento (antes do fim do período) e volta a agendar a cobrança mensal */
  async reactivateRenewal(userId: string) {
    const subscription = await this.prisma.subscription.findFirst({
      where: { userId, status: "ACTIVE" },
      orderBy: { expiresAt: "desc" },
    });
    if (!subscription || !subscription.expiresAt || subscription.expiresAt <= new Date()) {
      throw new BadRequestException("Não há assinatura para reativar. Faça uma nova assinatura.");
    }
    if (!subscription.cancelAtPeriodEnd) return this.getMySubscription(userId);

    await this.prisma.subscription.update({
      where: { id: subscription.id },
      data: { cancelAtPeriodEnd: false, canceledAt: null },
    });
    await this.ensureRecurringBilling(subscription.id);
    return this.getMySubscription(userId);
  }

  /**
   * Devolve a mensalidade em aberto (com Pix) para o usuário pagar agora, inclusive antes do vencimento.
   */
  async renewSubscription(userId: string, _input?: RenewSubscriptionInput) {
    const subscription = await this.prisma.subscription.findFirst({
      where: { userId, status: "ACTIVE" },
      orderBy: { expiresAt: "desc" },
    });
    if (!subscription) throw new NotFoundException("Você não possui assinatura ativa.");
    if (subscription.cancelAtPeriodEnd) {
      throw new BadRequestException("A renovação está cancelada. Reative a renovação para pagar.");
    }

    let invoice = await this.findOpenInvoice(userId, subscription.id);
    if (!invoice && subscription.asaasSubscriptionId) {
      await this.paymentsService.syncSubscriptionInvoices(subscription);
      invoice = await this.findOpenInvoice(userId, subscription.id);
    }
    if (!invoice) {
      throw new ConflictException("Nenhuma mensalidade em aberto no momento. A cobrança é gerada pelo Asaas antes do vencimento.");
    }
    return this.paymentsService.getPaymentById(userId, invoice.id);
  }
}
