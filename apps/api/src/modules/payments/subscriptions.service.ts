import {
  BadRequestException,
  ForbiddenException,
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
  NotFoundException,
} from "@nestjs/common";
import { timingSafeEqual } from "crypto";
import { PrismaService } from "../../common/prisma/prisma.service";
import { PaymentEmailService } from "./payment-email.service";
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
  ) {}

  /**
   * Ativa plano após validação do código de 6 dígitos enviado por e-mail (Regras 18, 19, 21, 22, 24)
   */
  async activateSubscription(userId: string, input: ActivateSubscriptionInput) {
    const { paymentId, code } = input;

    // 1. Busca pagamento
    const payment = await this.prisma.payment.findUnique({
      where: { id: paymentId },
      include: {
        activationCode: true,
        user: true,
      },
    });

    if (!payment) {
      throw new NotFoundException("Pagamento não encontrado.");
    }

    if (payment.userId !== userId) {
      throw new ForbiddenException("Este pagamento pertence a outro usuário.");
    }

    // Regra 17 & 21: Não ativa plano se o pagamento não estiver confirmado no Asaas / backend
    if (payment.status !== "PAID") {
      throw new BadRequestException("O pagamento ainda não foi confirmado. Aguarde a compensação do Pix.");
    }

    const activation = payment.activationCode;
    if (!activation) {
      throw new BadRequestException("Código de ativação não encontrado para este pagamento.");
    }

    // Regra 18: Não pode ser reutilizado
    if (activation.usedAt) {
      throw new BadRequestException("Este código de ativação já foi utilizado.");
    }

    // Regra 18: Validade de 30 minutos
    const now = new Date();
    if (activation.expiresAt <= now) {
      throw new BadRequestException("Este código de ativação expirou. Solicite um novo código.");
    }

    // Regra 19: Proteção contra força bruta (máximo 5 tentativas)
    if (activation.attempts >= 5) {
      throw new HttpException(
        "Excesso de tentativas incorretas. Este código foi bloqueado por segurança.",
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    // Validação criptográfica do código através de hash com timingSafeEqual
    const computedHash = this.paymentsService.hashCode(userId, paymentId, code);
    const submittedBuffer = Buffer.from(computedHash, "hex");
    const storedBuffer = Buffer.from(activation.codeHash, "hex");

    if (
      submittedBuffer.length !== storedBuffer.length ||
      !timingSafeEqual(submittedBuffer, storedBuffer)
    ) {
      await this.prisma.paymentActivationCode.update({
        where: { id: activation.id },
        data: { attempts: { increment: 1 } },
      });
      throw new BadRequestException("Código de ativação inválido. Verifique os números informados.");
    }

    // Código válido! Marca como utilizado
    await this.prisma.paymentActivationCode.update({
      where: { id: activation.id },
      data: { usedAt: now },
    });

    // 2. Cálculo da data de expiração (Regra 22 e 24)
    // Se o usuário já tiver assinatura ativa, soma 30 dias na data de expiração existente
    const existingSubscription = await this.prisma.subscription.findFirst({
      where: {
        userId,
        status: "ACTIVE",
        expiresAt: { gt: now },
      },
      orderBy: { expiresAt: "desc" },
    });

    let startedAt = now;
    let expiresAt: Date;

    if (existingSubscription?.expiresAt && existingSubscription.expiresAt > now) {
      // Regra 24: Não perde dias restantes!
      expiresAt = new Date(existingSubscription.expiresAt.getTime() + 30 * 24 * 60 * 60 * 1000);
      this.logger.log(`Renovação antecipada do usuário ${userId}. Nova expiração: ${expiresAt.toISOString()}`);
    } else {
      expiresAt = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
      this.logger.log(`Nova assinatura ativada para usuário ${userId}. Expiração: ${expiresAt.toISOString()}`);
    }

    // 3. Atualiza ou cria a entidade Subscription (Regra 12)
    let subscription;
    if (existingSubscription) {
      subscription = await this.prisma.subscription.update({
        where: { id: existingSubscription.id },
        data: {
          plan: payment.plan,
          status: "ACTIVE",
          expiresAt,
          renewalReminderSentAt: null, // Reset do aviso para o novo ciclo (Regra 26)
        },
      });
    } else {
      subscription = await this.prisma.subscription.create({
        data: {
          userId,
          plan: payment.plan,
          status: "ACTIVE",
          startedAt,
          expiresAt,
          renewalReminderSentAt: null,
        },
      });
    }

    // 4. Vincula o pagamento à assinatura
    await this.prisma.payment.update({
      where: { id: payment.id },
      data: { subscriptionId: subscription.id },
    });

    // 5. Atualiza o usuário com o plano ativo
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        planTier: payment.plan,
        planStartedAt: subscription.startedAt || startedAt,
        planRenewsAt: expiresAt,
      },
    });

    const planConfig = getPlanConfig(payment.plan);

    return {
      success: true,
      message: `Plano ${planConfig.name} ativado com sucesso! Válido até ${expiresAt.toLocaleDateString("pt-BR")}.`,
      subscription: {
        id: subscription.id,
        plan: subscription.plan,
        status: subscription.status,
        startedAt: subscription.startedAt?.toISOString() || null,
        expiresAt: subscription.expiresAt?.toISOString() || null,
      },
    };
  }

  /**
   * Consulta a assinatura atual do usuário e verifica expiração e aviso de 3 dias (Regras 25, 26, 27)
   */
  async getMySubscription(userId: string) {
    const now = new Date();

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        email: true,
        planTier: true,
        planStartedAt: true,
        planRenewsAt: true,
        companyEnabled: true,
      },
    });

    if (!user) {
      throw new NotFoundException("Usuário não encontrado.");
    }

    const subscription = await this.prisma.subscription.findFirst({
      where: { userId },
      orderBy: { createdAt: "desc" },
    });

    // Regra 27: Se expirou, atualiza para EXPIRED e usuário volta para FREE
    if (subscription && subscription.status === "ACTIVE" && subscription.expiresAt && subscription.expiresAt <= now) {
      this.logger.log(`Assinatura ${subscription.id} do usuário ${userId} expirou.`);
      await this.prisma.subscription.update({
        where: { id: subscription.id },
        data: { status: "EXPIRED" },
      });
      await this.prisma.user.update({
        where: { id: userId },
        data: { planTier: "FREE" },
      });
      subscription.status = "EXPIRED";
    }

    // Regra 25 & 26: Aviso de 3 dias
    let daysRemaining = 0;
    let isExpiringSoon = false;

    if (subscription && subscription.status === "ACTIVE" && subscription.expiresAt && subscription.expiresAt > now) {
      const diffMs = subscription.expiresAt.getTime() - now.getTime();
      daysRemaining = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

      if (daysRemaining <= 3) {
        isExpiringSoon = true;

        // Envia notificação apenas uma vez por período (Regra 26)
        if (!subscription.renewalReminderSentAt) {
          await this.prisma.subscription.update({
            where: { id: subscription.id },
            data: { renewalReminderSentAt: now },
          });

          const planConfig = getPlanConfig(subscription.plan);
          await this.paymentEmailService.sendRenewalReminderEmail({
            to: user.email,
            userName: user.name,
            planName: planConfig.name,
            daysRemaining,
            expiresAtDateString: subscription.expiresAt.toLocaleDateString("pt-BR"),
          });
          this.logger.log(`Aviso de renovação (3 dias) disparado para usuário ${userId}.`);
        }
      }
    }

    const currentPlanKey = subscription?.status === "ACTIVE" ? subscription.plan : PlanKey.FREE;
    const planConfig = getPlanConfig(currentPlanKey);

    return {
      hasActiveSubscription: subscription?.status === "ACTIVE",
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
    };
  }

  /**
   * Inicia renovação manual de assinatura (Regra 23, 24)
   */
  async renewSubscription(userId: string, input: RenewSubscriptionInput) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        email: true,
        cpf: true,
        asaasCustomerId: true,
        planTier: true,
      },
    });

    if (!user) {
      throw new NotFoundException("Usuário não encontrado.");
    }

    // Se o plano não for especificado, utiliza o plano atual do usuário ou PROFESSIONAL
    const targetPlan = input.plan || (user.planTier !== "FREE" ? user.planTier : "PROFESSIONAL");
    const planKey = normalizePlanKey(targetPlan);

    if (planKey === PlanKey.FREE) {
      throw new BadRequestException("O plano gratuito não necessita de renovação por pagamento.");
    }

    // Reutiliza dados cadastrados do usuário
    return this.paymentsService.createPayment(userId, {
      plan: planKey,
      name: user.name,
      email: user.email,
      cpf: user.cpf || "00000000000",
    });
  }
}
