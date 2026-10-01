import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  UnauthorizedException,
  ServiceUnavailableException,
} from "@nestjs/common";
import { createHash, createHmac, randomInt, timingSafeEqual, randomUUID } from "crypto";
import { Prisma } from "@prisma/client";
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
import { decryptCpf, encryptCpf } from "./utils/cpf-crypto";

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
  async createPayment(userId: string, input: CreatePaymentInput, idempotencyKey?: string) {
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
    const normalizedEmail = payer.email.toLowerCase();
    const requestKey = idempotencyKey?.trim() || randomUUID();
    if (requestKey.length > 120) throw new BadRequestException("Chave de idempotência inválida.");

    // 3. Busca usuário no banco
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        name: true,
        asaasCustomerId: true,
        cpf: true,
        cpfEncrypted: true,
        emailVerifiedAt: true,
      },
    });

    if (!user) {
      throw new NotFoundException("Usuário não encontrado.");
    }
    if (!user.emailVerifiedAt) {
      throw new ForbiddenException("Confirme seu email antes de contratar um plano.");
    }
    if (normalizedEmail !== user.email.toLowerCase()) {
      throw new BadRequestException("Use o email verificado da sua conta para o pagamento.");
    }
    const storedCpf = user.cpfEncrypted ? decryptCpf(user.cpfEncrypted) : user.cpf?.replace(/\D/g, "");
    if (storedCpf && storedCpf !== payer.cpf) {
      throw new BadRequestException("O CPF informado difere do CPF já associado à sua conta.");
    }

    let payment = await this.prisma.payment.findUnique({ where: { requestKey } });
    if (payment && payment.userId !== user.id) {
      throw new ConflictException("Chave de idempotência já utilizada.");
    }
    if (payment && (payment.plan !== toPrismaPlanTier(planKey) || Number(payment.amount) !== planConfig.price)) {
      throw new ConflictException("Esta chave de idempotência já está vinculada a outro plano.");
    }
    if (payment?.providerPaymentId && payment.pixQrCode && payment.pixCopyPaste) {
      return this.formatPaymentResponse(payment, planKey);
    }

    let reservedNow = false;
    if (!payment) {
      try {
        payment = await this.prisma.payment.create({
          data: {
            userId: user.id,
            plan: toPrismaPlanTier(planKey),
            amount: planConfig.price,
            provider: "ASAAS",
            status: "PENDING",
            requestKey,
          },
        });
        reservedNow = true;
      } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
          payment = await this.prisma.payment.findUnique({ where: { requestKey } });
          if (!payment || payment.userId !== user.id) throw new ConflictException("Cobrança em processamento.");
          if (payment.providerPaymentId && payment.pixQrCode && payment.pixCopyPaste) {
            return this.formatPaymentResponse(payment, planKey);
          }
        } else {
          throw error;
        }
      }
    }

    if (!payment) throw new ConflictException("Cobrança em processamento. Tente novamente em instantes.");

    // Recover a charge if the request timed out after Asaas created it.
    let asaasPayment = payment.providerPaymentId
      ? await this.asaasService.getPayment(payment.providerPaymentId)
      : await this.asaasService
          .findPaymentsByExternalReference(payment.id)
          .then((items) => items.find((item) => item.externalReference === payment!.id));
    if (!reservedNow && !asaasPayment && !payment.providerPaymentId && Date.now() - payment.createdAt.getTime() < 30_000) {
      throw new ConflictException("Cobrança em processamento. Aguarde alguns segundos e consulte novamente.");
    }

    try {
      const asaasCustomerId = await this.asaasService.findOrCreateCustomer({
        name: payer.name,
        email: normalizedEmail,
        cpf: payer.cpf,
        userId: user.id,
        existingCustomerId: user.asaasCustomerId,
      });
      await this.prisma.user.update({
        where: { id: user.id },
        data: { asaasCustomerId, cpf: null, cpfEncrypted: encryptCpf(payer.cpf) },
      });

      if (!asaasPayment) {
        asaasPayment = await this.asaasService.createPixPayment({
          customerId: asaasCustomerId,
          amount: planConfig.price,
          description: `Assinatura Flance - Plano ${planConfig.name}`,
          externalReference: payment.id,
        });
      }

      const dueDate = asaasPayment.dueDate ? new Date(asaasPayment.dueDate) : new Date(Date.now() + 24 * 60 * 60 * 1000);
      await this.prisma.payment.update({
        where: { id: payment.id },
        data: { providerPaymentId: asaasPayment.id, dueDate },
      });
      const pixData = await this.asaasService.getPixQrCode(asaasPayment.id);
      const updatedPayment = await this.prisma.payment.update({
        where: { id: payment.id },
        data: { pixQrCode: pixData.encodedImage, pixCopyPaste: pixData.payload, pixExpiresAt: new Date(pixData.expirationDate) },
      });

      this.logger.log(`Cobrança Pix criada. LocalPayment=${payment.id} AsaasPayment=${asaasPayment.id}`);
      return this.formatPaymentResponse(updatedPayment, planKey, pixData.expirationDate);
    } catch (error) {
      // Keep the local Payment and requestKey so retry can reconcile by externalReference.
      throw error;
    }
  }

  private formatPaymentResponse(payment: any, plan: PlanKey, pixExpiresAt?: string) {
    return {
      paymentId: payment.id,
      status: payment.status,
      amount: Number(payment.amount),
      plan,
      pixQrCode: payment.pixQrCode,
      pixCopyPaste: payment.pixCopyPaste,
      dueDate: payment.dueDate?.toISOString() ?? null,
      expiresAt: pixExpiresAt ?? payment.pixExpiresAt?.toISOString() ?? null,
    };
  }

  async resendActivationCode(userId: string, paymentId: string) {
    const payment = await this.prisma.payment.findUnique({
      where: { id: paymentId },
      include: { user: true, activationCode: true },
    });
    if (!payment) throw new NotFoundException("Pagamento não encontrado.");
    if (payment.userId !== userId) throw new ForbiddenException("Acesso negado a este pagamento.");
    if (payment.status !== "PAID") throw new BadRequestException("O pagamento ainda não foi confirmado.");
    const activation = payment.activationCode;
    if (!activation || activation.usedAt) throw new BadRequestException("Não há código pendente para este pagamento.");
    if (activation.resendCount >= 3) throw new BadRequestException("Limite de reenvios atingido. Contate o suporte.");
    const now = new Date();
    if (activation.lastSentAt && now.getTime() - activation.lastSentAt.getTime() < 60_000) {
      const seconds = Math.ceil((60_000 - (now.getTime() - activation.lastSentAt.getTime())) / 1000);
      throw new ConflictException(`Aguarde ${seconds} segundos para solicitar outro código.`);
    }

    const code = String(randomInt(100_000, 1_000_000));
    const codeHash = this.hashCode(userId, paymentId, code);
    const expiresAt = new Date(now.getTime() + 30 * 60 * 1000);
    const claimed = await this.prisma.paymentActivationCode.updateMany({
      where: {
        id: activation.id,
        usedAt: null,
        resendCount: { lt: 3 },
        OR: [{ lastSentAt: null }, { lastSentAt: { lte: new Date(now.getTime() - 60_000) } }],
      },
      data: {
        codeHash,
        attempts: 0,
        resendCount: { increment: 1 },
        lastSentAt: now,
        emailSentAt: null,
        expiresAt,
      },
    });
    if (claimed.count !== 1) throw new ConflictException("O código já foi reenviado ou utilizado. Atualize o pagamento.");

    const emailSent = await this.paymentEmailService.sendActivationCodeEmail({
      to: payment.user.email,
      userName: payment.user.name,
      planName: getPlanConfig(payment.plan).name,
      code,
      expiresInMinutes: 30,
    });
    if (emailSent) {
      await this.prisma.paymentActivationCode.updateMany({
        where: { id: activation.id, codeHash },
        data: { emailSentAt: new Date() },
      });
    }
    return { sent: emailSent, expiresAt: expiresAt.toISOString() };
  }

  /**
   * Consulta status do pagamento (Regra 14, 33)
   * Se pendente, consulta Asaas para fallback caso o webhook tenha atraso de rede
   */
  async getPaymentById(userId: string, paymentId: string) {
    const payment = await this.prisma.payment.findUnique({
      where: { id: paymentId },
      include: {
        user: { select: { id: true, email: true, name: true, asaasCustomerId: true } },
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
        if (asaasData.status === "RECEIVED") {
          this.logger.log(`Pagamento ${payment.id} recebido no Asaas durante consulta. Processando confirmação.`);
          await this.processPaymentConfirmation(payment.id, asaasData);
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
    const expectedToken = process.env.ASAAS_WEBHOOK_TOKEN?.trim();
    if (!expectedToken) {
      this.logger.error("ASAAS_WEBHOOK_TOKEN não configurado; webhook recusado por segurança.");
      throw new ServiceUnavailableException("Webhook de pagamento não configurado.");
    }
    const tokenHeader = Object.entries(headers).find(([name]) => name.toLowerCase() === "asaas-access-token")?.[1];
    const receivedToken = Array.isArray(tokenHeader) ? tokenHeader[0] : tokenHeader;
    const expectedBuffer = Buffer.from(expectedToken);
    const receivedBuffer = Buffer.from(receivedToken || "");
    if (expectedBuffer.length !== receivedBuffer.length || !timingSafeEqual(expectedBuffer, receivedBuffer)) {
      throw new UnauthorizedException("Token de webhook inválido.");
    }

    const event = typeof body?.event === "string" ? body.event : "";
    const providerPaymentId = typeof body?.payment?.id === "string" ? body.payment.id : "";
    if (!event || !providerPaymentId) throw new BadRequestException("Evento ou identificador do pagamento ausente.");

    const eventId = typeof body?.id === "string" && body.id.length > 0
      ? body.id
      : `payload_${createHash("sha256").update(JSON.stringify({
          event,
          providerPaymentId,
          status: body?.payment?.status,
          paymentDate: body?.payment?.paymentDate,
          dateCreated: body?.dateCreated,
        })).digest("hex")}`;
    const safePayload = {
      id: eventId,
      event,
      payment: {
        id: providerPaymentId,
        status: typeof body?.payment?.status === "string" ? body.payment.status : null,
        value: typeof body?.payment?.value === "number" ? body.payment.value : null,
        customer: typeof body?.payment?.customer === "string" ? body.payment.customer : null,
        externalReference: typeof body?.payment?.externalReference === "string" ? body.payment.externalReference : null,
      },
    };

    let claimed = false;
    try {
      await this.prisma.paymentWebhookEvent.create({
        data: {
          eventId,
          eventType: event,
          providerPaymentId,
          status: "PROCESSING",
          payload: safePayload,
        },
      });
      claimed = true;
    } catch (error) {
      if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== "P2002") throw error;
      const claim = await this.prisma.paymentWebhookEvent.updateMany({
        where: { eventId, status: { in: ["RECEIVED", "FAILED"] } },
        data: { status: "PROCESSING", errorMessage: null },
      });
      claimed = claim.count === 1;
    }

    if (!claimed) return { received: true, processed: false, reason: "Duplicate or currently processing event" };

    try {
      const payment = await this.prisma.payment.findUnique({
        where: { providerPaymentId },
        include: { user: true },
      });
      if (!payment) throw new NotFoundException("Pagamento não encontrado para o evento recebido.");

      let result: Record<string, unknown> = { received: true, processed: true };
      if (event === "PAYMENT_RECEIVED" || event === "PAYMENT_CONFIRMED") {
        const remotePayment = await this.asaasService.getPayment(providerPaymentId);
        if (remotePayment.status !== "RECEIVED") {
          result = { received: true, processed: false, reason: "Asaas payment is not settled yet", providerStatus: remotePayment.status };
        } else {
          this.assertPaymentMatchesProvider(payment, remotePayment);
          const confirmation = await this.processPaymentConfirmation(payment.id, remotePayment);
          result = { received: true, processed: confirmation.newlyPaid, status: "PAID", emailSent: confirmation.emailSent };
        }
      } else if (event === "PAYMENT_OVERDUE") {
        await this.prisma.payment.updateMany({
          where: { id: payment.id, status: "PENDING" },
          data: { status: "EXPIRED" },
        });
        result = { received: true, processed: true, status: "EXPIRED" };
      } else if (event === "PAYMENT_DELETED" || event === "PAYMENT_REFUNDED") {
        const newStatus = event === "PAYMENT_REFUNDED" ? "REFUNDED" : "CANCELED";
        await this.prisma.payment.updateMany({
          where: { id: payment.id, status: { in: ["PENDING", "PAID"] } },
          data: { status: newStatus },
        });
        result = { received: true, processed: true, status: newStatus };
      } else {
        result = { received: true, ignored: true, event };
      }

      await this.prisma.paymentWebhookEvent.update({
        where: { eventId },
        data: { status: "PROCESSED", processedAt: new Date() },
      });
      return result;
    } catch (error) {
      await this.prisma.paymentWebhookEvent.update({
        where: { eventId },
        data: {
          status: "FAILED",
          errorMessage: error instanceof Error ? error.message.slice(0, 500) : "Unknown processing error",
        },
      });
      throw error;
    }
  }

  /**
   * Confirma pagamento e gera código de ativação único (Regras 16, 18, 19, 20)
   */
  async processPaymentConfirmation(paymentId: string, remotePayment?: Awaited<ReturnType<AsaasService["getPayment"]>>) {
    const now = new Date();
    const code = String(randomInt(100000, 1000000));
    const codeHash = this.hashCode("pending", paymentId, code);
    const expiresAt = new Date(now.getTime() + 30 * 60 * 1000);

    const claimedPayment = await this.prisma.$transaction(async (transaction) => {
      const payment = await transaction.payment.findUnique({
        where: { id: paymentId },
        include: { user: true },
      });
      if (!payment) throw new NotFoundException("Pagamento não encontrado.");
      if (remotePayment) this.assertPaymentMatchesProvider(payment, remotePayment);
      if (payment.status !== "PENDING") return null;

      const claim = await transaction.payment.updateMany({
        where: { id: payment.id, status: "PENDING" },
        data: { status: "PAID", paidAt: now },
      });
      if (claim.count !== 1) return null;

      await transaction.paymentActivationCode.upsert({
        where: { paymentId: payment.id },
        create: {
          userId: payment.userId,
          paymentId: payment.id,
          plan: payment.plan,
          codeHash: this.hashCode(payment.userId, payment.id, code),
          attempts: 0,
          resendCount: 0,
          lastSentAt: now,
          emailSentAt: null,
          expiresAt,
        },
        update: {
          codeHash: this.hashCode(payment.userId, payment.id, code),
          attempts: 0,
          lastSentAt: now,
          emailSentAt: null,
          usedAt: null,
          expiresAt,
        },
      });
      return payment;
    });

    if (!claimedPayment) return { newlyPaid: false, emailSent: false };

    const planConfig = getPlanConfig(claimedPayment.plan);
    const emailSent = await this.paymentEmailService.sendActivationCodeEmail({
      to: claimedPayment.user.email,
      userName: claimedPayment.user.name,
      planName: planConfig.name,
      code,
      expiresInMinutes: 30,
    });
    if (emailSent) {
      await this.prisma.paymentActivationCode.updateMany({
        where: { paymentId: claimedPayment.id, codeHash: this.hashCode(claimedPayment.userId, claimedPayment.id, code) },
        data: { emailSentAt: new Date() },
      });
    }
    this.logger.log(`Pagamento ${paymentId} confirmado; código de ativação gerado. EmailSent=${emailSent}`);
    return { newlyPaid: true, emailSent };
  }

  private assertPaymentMatchesProvider(
    payment: { id: string; providerPaymentId: string | null; amount: unknown; user: { asaasCustomerId: string | null } },
    remote: { id: string; status: string; value: number; customer: string; externalReference?: string },
  ) {
    if (remote.id !== payment.providerPaymentId || remote.externalReference !== payment.id) {
      throw new ForbiddenException("Referência do pagamento não corresponde ao registro local.");
    }
    if (remote.status !== "RECEIVED") {
      throw new BadRequestException("O pagamento ainda não está liquidado no Asaas.");
    }
    if (Math.round(remote.value * 100) !== Math.round(Number(payment.amount) * 100)) {
      throw new ForbiddenException("O valor confirmado pelo Asaas não corresponde ao pagamento local.");
    }
    if (!payment.user.asaasCustomerId || remote.customer !== payment.user.asaasCustomerId) {
      throw new ForbiddenException("O cliente confirmado pelo Asaas não corresponde à cobrança local.");
    }
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
