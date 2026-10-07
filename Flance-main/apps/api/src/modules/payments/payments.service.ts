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
import { AsaasService, type AsaasPaymentResponse } from "./asaas.service";
import { ContractsService } from "../contracts/contracts.service";
import { addBillingMonth, computeInitialCharge, fromAsaasDate, getAccessDeadline } from "./billing/billing-schedule";
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
    private readonly contractsService: ContractsService,
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
   * Simulação exibida ANTES do aceite: valor cheio hoje e renovação mensal no mesmo dia.
   */
  getQuote(planInput: string) {
    const planKey = normalizePlanKey(planInput);
    const planConfig = getPlanConfig(planKey);
    if (!planConfig.isPaid) throw new BadRequestException("O plano FREE não necessita de pagamento.");
    const charge = computeInitialCharge(new Date(), planConfig.price);
    return {
      plan: planKey,
      planName: planConfig.name,
      billingAnchorDay: charge.billingAnchorDay,
      recurringAmount: charge.recurringAmount,
      initialAmount: charge.initialAmount,
      // Indicativo: o mês começa na ATIVAÇÃO do plano (a data real é a da ativação)
      firstRenewalDate: charge.firstRenewalDate.toISOString(),
    };
  }

  /**
   * Cria o 1º pagamento (Pix do valor cheio, cobre o primeiro mês) para um plano pago.
   * Exige o aceite do contrato vigente e registra a prova do aceite.
   */
  async createPayment(
    userId: string,
    input: CreatePaymentInput,
    idempotencyKey?: string,
    meta: { ipAddress?: string | null; userAgent?: string | null } = {},
  ) {
    // 1. Valida plano
    const planKey = normalizePlanKey(input.plan);
    const planConfig = getPlanConfig(planKey);

    if (!planConfig.isPaid) {
      throw new BadRequestException("O plano FREE não necessita de pagamento.");
    }

    // 1b. Contrato: o usuário precisa ter aceitado exatamente a versão vigente
    const contract = this.contractsService.assertCurrent(input.contractVersion, input.contractHash);
    const charge = computeInitialCharge(new Date(), planConfig.price);

    // 1c. Não permite assinar de novo enquanto há assinatura ativa (evita cobrança em duplicidade)
    const activeSubscription = await this.prisma.subscription.findFirst({
      where: { userId, status: "ACTIVE" },
      orderBy: { expiresAt: "desc" },
    });
    if (activeSubscription?.expiresAt && getAccessDeadline(activeSubscription.expiresAt) > new Date()) {
      throw new ConflictException(
        "Você já possui uma assinatura ativa. Gerencie ou cancele a renovação em \"Minha assinatura\" para trocar de plano.",
      );
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
    if (payment && payment.plan !== toPrismaPlanTier(planKey)) {
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
            amount: charge.initialAmount,
            provider: "ASAAS",
            status: "PENDING",
            kind: "INITIAL",
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

    // Prova do aceite (texto exato, hash, IP, navegador). Idempotente por pagamento.
    await this.contractsService.recordAcceptance({
      userId: user.id,
      paymentId: payment.id,
      contractVersion: contract.version,
      contractHash: contract.hash,
      plan: toPrismaPlanTier(planKey),
      planPrice: planConfig.price,
      billingAnchorDay: charge.billingAnchorDay,
      initialAmount: Number(payment.amount),
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });

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
          amount: Number(payment.amount),
          description: `Assinatura Flance - Plano ${planConfig.name} (1º mês)`,
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
      kind: payment.kind ?? "INITIAL",
      coversUntil: payment.coversUntil?.toISOString() ?? null,
      paidAt: payment.paidAt?.toISOString() ?? null,
    };
  }

  /** Pagamento já confirmado que aguarda o código (usado pelo link do e-mail: /checkout?step=code) */
  async getPendingActivation(userId: string) {
    const payment = await this.prisma.payment.findFirst({
      where: { userId, status: "PAID", kind: "INITIAL", subscriptionId: null, activationCode: { is: { usedAt: null } } },
      orderBy: { paidAt: "desc" },
    });
    if (!payment) return null;
    return { paymentId: payment.id, plan: payment.plan, amount: Number(payment.amount), paidAt: payment.paidAt?.toISOString() ?? null };
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

    // Sincronização sob demanda com Asaas se ainda constar como PENDING (fallback do webhook)
    let current = payment;
    if (current.status === "PENDING" && current.providerPaymentId) {
      try {
        const asaasData = await this.asaasService.getPayment(current.providerPaymentId);
        if (asaasData.status === "RECEIVED") {
          this.logger.log(`Pagamento ${current.id} recebido no Asaas durante consulta. Processando confirmação.`);
          await this.processPaymentConfirmation(current.id, asaasData);
          const updated = await this.prisma.payment.findUnique({
            where: { id: paymentId },
            include: { user: { select: { id: true, email: true, name: true, asaasCustomerId: true } } },
          });
          if (updated) current = updated;
        }
      } catch (err: any) {
        this.logger.warn(`Não foi possível sincronizar status no Asaas para ${current.id}: ${err?.message}`);
      }
    }

    // Cobrança mensal nasce sem QR Code (e o Pix pode expirar): busca/renova sob demanda
    const needsQr =
      current.status !== "PAID" &&
      current.providerPaymentId &&
      (!current.pixQrCode || !current.pixExpiresAt || current.pixExpiresAt <= new Date());
    if (needsQr && current.status !== "CANCELED" && current.status !== "REFUNDED") {
      try {
        const pix = await this.asaasService.getPixQrCode(current.providerPaymentId!);
        const refreshed = await this.prisma.payment.update({
          where: { id: current.id },
          data: { pixQrCode: pix.encodedImage, pixCopyPaste: pix.payload, pixExpiresAt: new Date(pix.expirationDate) },
          include: { user: { select: { id: true, email: true, name: true, asaasCustomerId: true } } },
        });
        current = refreshed;
      } catch (err: any) {
        this.logger.warn(`Não foi possível obter o QR Code Pix de ${current.id}: ${err?.message}`);
      }
    }

    return { ...this.formatPaymentResponse(current, current.plan as PlanKey), createdAt: current.createdAt.toISOString() };
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
    if (!event) throw new BadRequestException("Evento ausente.");
    // Eventos que não são de cobrança (conta, transferência, etc.) são reconhecidos e ignorados.
    // Responder erro faria o Asaas acumular falhas e pausar a fila de webhooks.
    if (!event.startsWith("PAYMENT_") || !providerPaymentId) {
      this.logger.log(`Evento ${event} ignorado (não é de cobrança).`);
      return { received: true, ignored: true, reason: "Not a payment event" };
    }

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
      const payment = await this.resolveLocalPayment(providerPaymentId, body?.payment);
      if (!payment) {
        // Cobrança que não é do Flance (ex.: criada à mão no painel do Asaas): responde 200 para
        // não acumular falhas — o Asaas pausa a fila de webhooks após falhas seguidas.
        await this.prisma.paymentWebhookEvent.update({
          where: { eventId },
          data: { status: "PROCESSED", processedAt: new Date() },
        });
        return { received: true, ignored: true, reason: "Payment not managed by Flance" };
      }

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
          // Exclusão nunca pode "cancelar" uma cobrança já paga; só o estorno atinge pagamentos PAID
          where: {
            id: payment.id,
            status: { in: event === "PAYMENT_REFUNDED" ? ["PENDING", "PAID"] : ["PENDING", "EXPIRED"] },
          },
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
    const kindRow = await this.prisma.payment.findUnique({ where: { id: paymentId }, select: { kind: true } });
    if (kindRow?.kind === "RECURRING") {
      if (!remotePayment) throw new BadRequestException("Dados do Asaas ausentes para confirmar a mensalidade.");
      return this.confirmRecurringPayment(paymentId, remotePayment);
    }

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
    payment: {
      id: string;
      providerPaymentId: string | null;
      amount: unknown;
      kind?: string | null;
      providerSubscriptionId?: string | null;
      user: { asaasCustomerId: string | null };
    },
    remote: { id: string; status: string; value: number; customer: string; externalReference?: string; subscription?: string },
  ) {
    // Mensalidade: a referência é a assinatura (o Asaas não copia o id local para cada cobrança gerada)
    const referenceOk =
      payment.kind === "RECURRING"
        ? Boolean(payment.providerSubscriptionId) && remote.subscription === payment.providerSubscriptionId
        : remote.externalReference === payment.id;
    if (remote.id !== payment.providerPaymentId || !referenceOk) {
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
   * Descobre a cobrança local de um evento do Asaas:
   *  1) pelo id do Asaas;
   *  2) se vier de uma assinatura nossa, cria a mensalidade local (RECURRING) a partir dos dados do Asaas;
   *  3) pelo externalReference (corrida: webhook chegou antes de gravarmos o id do Asaas).
   * Retorna null para cobranças que não são do Flance.
   */
  private async resolveLocalPayment(providerPaymentId: string, eventPayment: any) {
    const include = { user: true } as const;
    const found = await this.prisma.payment.findUnique({ where: { providerPaymentId }, include });
    if (found) return found;

    const providerSubscriptionId = typeof eventPayment?.subscription === "string" ? eventPayment.subscription : null;
    if (providerSubscriptionId) {
      const subscription = await this.prisma.subscription.findUnique({ where: { asaasSubscriptionId: providerSubscriptionId } });
      if (!subscription) {
        this.logger.warn(`Cobrança ${providerPaymentId} de assinatura desconhecida (${providerSubscriptionId}); será reconciliada pela rotina.`);
        return null;
      }
      const remote = await this.asaasService.getPayment(providerPaymentId);
      if (remote.subscription !== providerSubscriptionId) return null;
      await this.upsertRecurringPayment(subscription, remote);
      return this.prisma.payment.findUnique({ where: { providerPaymentId }, include });
    }

    const reference = typeof eventPayment?.externalReference === "string" ? eventPayment.externalReference : null;
    if (reference) {
      const local = await this.prisma.payment.findUnique({ where: { id: reference }, include });
      if (local && !local.providerPaymentId) {
        await this.prisma.payment.updateMany({ where: { id: local.id, providerPaymentId: null }, data: { providerPaymentId } });
        return this.prisma.payment.findUnique({ where: { providerPaymentId }, include });
      }
    }
    return null;
  }

  /** Cria (idempotente) a mensalidade local a partir da cobrança gerada pela assinatura do Asaas */
  async upsertRecurringPayment(
    subscription: { id: string; userId: string; plan: any; asaasSubscriptionId: string | null; billingAnchorDay: number },
    remote: AsaasPaymentResponse,
  ) {
    const existing = await this.prisma.payment.findUnique({ where: { providerPaymentId: remote.id } });
    if (existing) return existing;

    const dueDate = fromAsaasDate(remote.dueDate);
    try {
      return await this.prisma.payment.create({
        data: {
          userId: subscription.userId,
          subscriptionId: subscription.id,
          plan: subscription.plan,
          amount: remote.value,
          provider: "ASAAS",
          providerPaymentId: remote.id,
          providerSubscriptionId: subscription.asaasSubscriptionId,
          kind: "RECURRING",
          status: "PENDING",
          dueDate,
          coversUntil: addBillingMonth(dueDate, subscription.billingAnchorDay),
        },
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        return this.prisma.payment.findUniqueOrThrow({ where: { providerPaymentId: remote.id } });
      }
      throw error;
    }
  }

  /** Traz do Asaas as cobranças pendentes de uma assinatura (rede de segurança caso um webhook se perca) */
  async syncSubscriptionInvoices(subscription: {
    id: string;
    userId: string;
    plan: any;
    asaasSubscriptionId: string | null;
    billingAnchorDay: number;
  }) {
    if (!subscription.asaasSubscriptionId) return [];
    const remotes = await this.asaasService.listSubscriptionPayments(subscription.asaasSubscriptionId, "PENDING");
    const synced = [];
    for (const remote of remotes) {
      if (remote.subscription && remote.subscription !== subscription.asaasSubscriptionId) continue;
      synced.push(await this.upsertRecurringPayment(subscription, remote));
    }
    return synced;
  }

  /**
   * Cancela as mensalidades em aberto (ao cancelar a renovação ou encerrar o plano).
   * Se o Asaas recusar o cancelamento, a cobrança é mantida: se for paga depois, o pagamento é honrado.
   */
  async cancelOpenRenewalInvoices(subscriptionId: string) {
    const invoices = await this.prisma.payment.findMany({
      where: { subscriptionId, kind: "RECURRING", status: { in: ["PENDING", "EXPIRED"] } },
    });
    for (const invoice of invoices) {
      try {
        if (invoice.providerPaymentId) await this.asaasService.deletePayment(invoice.providerPaymentId);
        await this.prisma.payment.updateMany({
          where: { id: invoice.id, status: { in: ["PENDING", "EXPIRED"] } },
          data: { status: "CANCELED" },
        });
      } catch (error: any) {
        this.logger.warn(`Não foi possível cancelar a cobrança ${invoice.id} no Asaas: ${error?.message}`);
      }
    }
  }

  /**
   * Mensalidade paga: estende o plano até o próximo vencimento. Sem código de ativação.
   * Atômico: só uma execução "vence" a transição PENDING/EXPIRED -> PAID.
   */
  private async confirmRecurringPayment(paymentId: string, remote: AsaasPaymentResponse) {
    const now = new Date();
    const result = await this.prisma.$transaction(async (tx) => {
      const payment = await tx.payment.findUnique({
        where: { id: paymentId },
        include: { user: true, subscription: true },
      });
      if (!payment) throw new NotFoundException("Pagamento não encontrado.");
      this.assertPaymentMatchesProvider(payment, remote);
      if (!payment.subscription) throw new BadRequestException("Mensalidade sem assinatura vinculada.");

      const claim = await tx.payment.updateMany({
        where: { id: payment.id, status: { in: ["PENDING", "EXPIRED"] } },
        data: { status: "PAID", paidAt: now },
      });
      if (claim.count !== 1) return null;

      // Pagou em dia (ou adiantado): vai até o mesmo dia do mês seguinte ao vencimento. Pagou tão tarde que
      // esse dia já passou: conta um mês a partir de agora.
      const anchor = payment.subscription.billingAnchorDay;
      let coversUntil = payment.coversUntil ?? addBillingMonth(payment.dueDate ?? now, anchor);
      if (coversUntil <= now) coversUntil = addBillingMonth(now, anchor);
      const expiresAt =
        payment.subscription.expiresAt && payment.subscription.expiresAt > coversUntil
          ? payment.subscription.expiresAt
          : coversUntil;

      await tx.subscription.update({
        where: { id: payment.subscription.id },
        data: { status: "ACTIVE", expiresAt, nextDueDate: expiresAt, renewalReminderSentAt: null },
      });
      await tx.user.update({
        where: { id: payment.userId },
        data: { planTier: payment.subscription.plan, planRenewsAt: expiresAt, companyEnabled: true },
      });
      return { payment, expiresAt };
    });

    if (!result) return { newlyPaid: false, emailSent: false };

    const emailSent = await this.paymentEmailService.sendRenewalConfirmedEmail({
      to: result.payment.user.email,
      userName: result.payment.user.name,
      planName: getPlanConfig(result.payment.plan).name,
      amount: Number(result.payment.amount),
      validUntil: result.expiresAt,
    });
    this.logger.log(`Mensalidade ${paymentId} paga; plano ativo até ${result.expiresAt.toISOString()}.`);
    return { newlyPaid: true, emailSent };
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
