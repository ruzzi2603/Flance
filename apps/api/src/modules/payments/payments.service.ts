import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from "@nestjs/common";
import { createHmac, randomInt, timingSafeEqual } from "crypto";
import { PrismaService } from "../../common/prisma/prisma.service";
import { AsaasService } from "./asaas.service";
import { PaymentEmailService } from "./payment-email.service";
import {
  getPlanConfig,
  normalizePlanKey,
  PlanKey,
  PLANS,
  toPrismaPlanTier,
} from "./plans.config";
import type { CreatePaymentInput } from "./schemas/payment.schema";
import { validatePayerData } from "./utils/payer-validator";

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly asaasService: AsaasService,
    private readonly paymentEmailService: PaymentEmailService,
  ) {}

  /**
   * Health check do módulo
   */
  health() {
    return { status: "ok", service: "payments" };
  }

  /**
   * Lista planos centralizados disponíveis (fonte da verdade)
   */
  getAvailablePlans() {
    return Object.values(PLANS).map((p) => ({
      key: p.key,
      name: p.name,
      price: p.price,
      durationDays: p.durationDays,
      maxAds: p.maxAds,
      maxPhotos: p.maxPhotos,
      analytics: p.analytics,
      featuredAds: p.featuredAds,
      prioritySearch: p.prioritySearch,
      description: p.description,
      isPaid: p.isPaid,
    }));
  }

  /**
   * Cria uma cobrança Pix no Asaas para um plano pago (Regra 9, 10, 13, 14)
   */
  async createPayment(userId: string, input: CreatePaymentInput) {
    // 1. Valida plano
    const planKey = normalizePlanKey(input.plan);
    const planConfig = getPlanConfig(planKey);

    if (!planConfig.isPaid) {
      throw new BadRequestException("O plano FREE não necessita de pagamento.");
    }

    // 2. Valida dados do pagador no backend (Regras 5, 6, 7, 8)
    const payer = validatePayerData({
      name: input.name,
      email: input.email,
      cpf: input.cpf,
    });

    // 3. Busca usuário no banco
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        name: true,
        asaasCustomerId: true,
        cpf: true,
      },
    });

    if (!user) {
      throw new NotFoundException("Usuário não encontrado.");
    }

    // 4. Obtém ou cria cliente no Asaas (Regra 10)
    const asaasCustomerId = await this.asaasService.findOrCreateCustomer({
      name: payer.name,
      email: payer.email,
      cpf: payer.cpf,
      userId: user.id,
      existingCustomerId: user.asaasCustomerId,
    });

    // Salva asaasCustomerId e CPF no usuário se ainda não existirem
    if (user.asaasCustomerId !== asaasCustomerId || !user.cpf) {
      await this.prisma.user.update({
        where: { id: user.id },
        data: {
          asaasCustomerId,
          cpf: payer.cpf,
        },
      });
    }

    // 5. Cria cobrança Pix no Asaas (Regra 9)
    const asaasPayment = await this.asaasService.createPixPayment({
      customerId: asaasCustomerId,
      amount: planConfig.price,
      description: `Assinatura Flance - Plano ${planConfig.name}`,
      externalReference: user.id,
    });

    // 6. Obtém dados do Pix (QR Code e Copia e Cola) (Regra 14)
    const pixData = await this.asaasService.getPixQrCode(asaasPayment.id);

    // 7. Salva entidade Payment no banco de dados (Regra 11)
    const prismaPlan = toPrismaPlanTier(planKey);
    const dueDate = asaasPayment.dueDate ? new Date(asaasPayment.dueDate) : new Date(Date.now() + 24 * 3600 * 1000);

    const payment = await this.prisma.payment.create({
      data: {
        userId: user.id,
        plan: prismaPlan,
        amount: planConfig.price,
        provider: "ASAAS",
        providerPaymentId: asaasPayment.id,
        status: "PENDING",
        dueDate,
        pixQrCode: pixData.encodedImage,
        pixCopyPaste: pixData.payload,
      },
    });

    this.logger.log(`Cobrança Pix criada com sucesso. PaymentId: ${payment.id}, AsaasId: ${asaasPayment.id}, Valor: R$ ${planConfig.price}`);

    return {
      paymentId: payment.id,
      status: payment.status,
      amount: planConfig.price,
      plan: planKey,
      pixQrCode: pixData.encodedImage,
      pixCopyPaste: pixData.payload,
      dueDate: payment.dueDate?.toISOString(),
      expiresAt: pixData.expirationDate,
    };
  }

  /**
   * Consulta status do pagamento (Regra 14, 33)
   * Se pendente, consulta Asaas para fallback caso o webhook tenha atraso de rede
   */
  async getPaymentById(userId: string, paymentId: string) {
    const payment = await this.prisma.payment.findUnique({
      where: { id: paymentId },
      include: {
        user: { select: { id: true, email: true, name: true } },
      },
    });

    if (!payment) {
      throw new NotFoundException("Pagamento não encontrado.");
    }

    if (payment.userId !== userId) {
      throw new ForbiddenException("Acesso negado a este pagamento.");
    }

    // Sincronização sob demanda com Asaas se ainda constar como PENDING
    if (payment.status === "PENDING" && payment.providerPaymentId) {
      try {
        const asaasData = await this.asaasService.getPayment(payment.providerPaymentId);
        if (asaasData.status === "RECEIVED" || asaasData.status === "CONFIRMED") {
          this.logger.log(`Pagamento ${payment.id} detectado como pago no Asaas durante consulta. Processando confirmação.`);
          await this.processPaymentConfirmation(payment.id);
          const updated = await this.prisma.payment.findUnique({ where: { id: paymentId } });
          if (updated) {
            return {
              paymentId: updated.id,
              status: updated.status,
              amount: Number(updated.amount),
              plan: updated.plan,
              paidAt: updated.paidAt?.toISOString() || null,
              pixQrCode: updated.pixQrCode,
              pixCopyPaste: updated.pixCopyPaste,
              createdAt: updated.createdAt.toISOString(),
            };
          }
        }
      } catch (err: any) {
        this.logger.warn(`Não foi possível sincronizar status no Asaas para ${payment.id}: ${err?.message}`);
      }
    }

    return {
      paymentId: payment.id,
      status: payment.status,
      amount: Number(payment.amount),
      plan: payment.plan,
      paidAt: payment.paidAt?.toISOString() || null,
      pixQrCode: payment.pixQrCode,
      pixCopyPaste: payment.pixCopyPaste,
      createdAt: payment.createdAt.toISOString(),
    };
  }

  /**
   * Processa Webhook do Asaas (Regras 15 e 16 - Idempotência Obrigatória)
   */
  async handleWebhook(headers: Record<string, string | string[] | undefined>, body: any) {
    // 1. Validação de autenticidade do Webhook
    const expectedToken = process.env.ASAAS_WEBHOOK_TOKEN;
    if (expectedToken) {
      const receivedToken = (headers["asaas-access-token"] as string) || (headers["asaas-access-token".toLowerCase()] as string);
      if (!receivedToken || receivedToken !== expectedToken) {
        this.logger.warn("Webhook Asaas rejeitado: Token de acesso ausente ou inválido.");
        throw new UnauthorizedException("Token de webhook inválido.");
      }
    }

    const event = body?.event;
    const providerPaymentId = body?.payment?.id;

    this.logger.log(`Recebido webhook Asaas. Evento: ${event}, ProviderPaymentId: ${providerPaymentId}`);

    if (!providerPaymentId) {
      return { received: true, ignored: true, reason: "Identificador de pagamento ausente" };
    }

    // 2. Localiza Payment no banco de dados através do identificador do Asaas
    const payment = await this.prisma.payment.findUnique({
      where: { providerPaymentId },
      include: {
        user: true,
        activationCode: true,
      },
    });

    if (!payment) {
      this.logger.warn(`Pagamento não encontrado no banco para o providerPaymentId: ${providerPaymentId}`);
      return { received: true, ignored: true, reason: "Pagamento não encontrado" };
    }

    // 3. Processamento de acordo com o evento
    if (event === "PAYMENT_CONFIRMED" || event === "PAYMENT_RECEIVED") {
      // Idempotência obrigatória (Regra 16): Se já estiver PAID, não repete processamento
      if (payment.status === "PAID") {
        this.logger.log(`Webhook idempotente: Pagamento ${payment.id} já está marcado como PAID. Ignorando.`);
        return { received: true, processed: false, reason: "Already paid" };
      }

      await this.processPaymentConfirmation(payment.id);
      return { received: true, processed: true, status: "PAID" };
    }

    if (event === "PAYMENT_OVERDUE") {
      if (payment.status === "PENDING") {
        await this.prisma.payment.update({
          where: { id: payment.id },
          data: { status: "EXPIRED" },
        });
        this.logger.log(`Pagamento ${payment.id} marcado como EXPIRED.`);
      }
      return { received: true, processed: true, status: "EXPIRED" };
    }

    if (event === "PAYMENT_DELETED" || event === "PAYMENT_REFUNDED") {
      const newStatus = event === "PAYMENT_REFUNDED" ? "REFUNDED" : "CANCELED";
      await this.prisma.payment.update({
        where: { id: payment.id },
        data: { status: newStatus },
      });
      this.logger.log(`Pagamento ${payment.id} marcado como ${newStatus}.`);
      return { received: true, processed: true, status: newStatus };
    }

    return { received: true, ignored: true, event };
  }

  /**
   * Confirma pagamento e gera código de ativação único (Regras 16, 18, 19, 20)
   */
  async processPaymentConfirmation(paymentId: string) {
    const payment = await this.prisma.payment.findUnique({
      where: { id: paymentId },
      include: { user: true, activationCode: true },
    });

    if (!payment) {
      throw new NotFoundException("Pagamento não encontrado.");
    }

    if (payment.status === "PAID" && payment.activationCode) {
      this.logger.log(`Pagamento ${paymentId} já confirmado anteriormente. Idempotente.`);
      return;
    }

    // 1. Marca pagamento como PAID (Regra 13)
    const paidAt = new Date();
    await this.prisma.payment.update({
      where: { id: payment.id },
      data: {
        status: "PAID",
        paidAt,
      },
    });

    // 2. Gera código aleatório de 6 dígitos criptograficamente seguro (Regra 18)
    const code = String(randomInt(100000, 1000000));

    // 3. Armazena hash do código (Regra 19)
    const codeHash = this.hashCode(payment.userId, payment.id, code);
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000); // 30 minutos

    await this.prisma.paymentActivationCode.upsert({
      where: { paymentId: payment.id },
      create: {
        userId: payment.userId,
        paymentId: payment.id,
        plan: payment.plan,
        codeHash,
        attempts: 0,
        expiresAt,
      },
      update: {
        codeHash,
        attempts: 0,
        expiresAt,
        usedAt: null,
      },
    });

    this.logger.log(`Código de ativação gerado para o pagamento ${payment.id}. Expira em: ${expiresAt.toISOString()}`);

    // 4. Envia e-mail com o código de ativação (Regra 20)
    const planConfig = getPlanConfig(payment.plan);
    await this.paymentEmailService.sendActivationCodeEmail({
      to: payment.user.email,
      userName: payment.user.name,
      planName: planConfig.name,
      code,
      expiresInMinutes: 30,
    });
  }

  /**
   * Hash criptográfico para o código de ativação (Regra 19)
   */
  hashCode(userId: string, paymentId: string, code: string): string {
    const secret = process.env.EMAIL_VERIFICATION_SECRET || process.env.JWT_SECRET || "flance-activation-secret";
    return createHmac("sha256", secret)
      .update(`${userId}:${paymentId}:${code}`)
      .digest("hex");
  }
}
