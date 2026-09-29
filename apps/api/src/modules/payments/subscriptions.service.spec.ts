import { createHash } from "crypto";
import {
  BadRequestException,
  ForbiddenException,
  HttpException,
} from "@nestjs/common";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SubscriptionsService } from "./subscriptions.service";

describe("SubscriptionsService", () => {
  let service: SubscriptionsService;
  let prismaMock: any;
  let paymentsServiceMock: any;
  let emailMock: any;

  beforeEach(() => {
    vi.clearAllMocks();

    prismaMock = {
      payment: {
        findUnique: vi.fn(),
        update: vi.fn(),
      },
      paymentActivationCode: {
        update: vi.fn(),
      },
      subscription: {
        findFirst: vi.fn(),
        findMany: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
      },
      user: {
        findUnique: vi.fn(),
        update: vi.fn(),
      },
    };

    paymentsServiceMock = {
      hashCode: vi.fn((userId, paymentId, code) => {
        return createHash("sha256").update(`${userId}:${paymentId}:${code}`).digest("hex");
      }),
      createPayment: vi.fn(),
    };

    emailMock = {
      sendRenewalReminderEmail: vi.fn().mockResolvedValue(true),
    };

    service = new SubscriptionsService(prismaMock, paymentsServiceMock, emailMock);
  });

  describe("Validação de Código e Ativação de Plano", () => {
    const validPaymentId = "pay-1";
    const validUserId = "user-1";
    const validCode = "739241";
    const validHash = createHash("sha256").update(`${validUserId}:${validPaymentId}:${validCode}`).digest("hex");

    it("deve ativar o plano com sucesso ao informar código correto", async () => {
      prismaMock.payment.findUnique.mockResolvedValue({
        id: validPaymentId,
        userId: validUserId,
        plan: "PROFESSIONAL",
        status: "PAID",
        activationCode: {
          id: "act-1",
          codeHash: validHash,
          attempts: 0,
          usedAt: null,
          expiresAt: new Date(Date.now() + 20 * 60 * 1000), // Válido por mais 20 min
        },
      });

      prismaMock.paymentActivationCode.update.mockResolvedValue({ id: "act-1" });
      prismaMock.subscription.findFirst.mockResolvedValue(null); // Nova assinatura
      prismaMock.subscription.create.mockResolvedValue({
        id: "sub-1",
        plan: "PROFESSIONAL",
        status: "ACTIVE",
        startedAt: new Date(),
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      });
      prismaMock.payment.update.mockResolvedValue({ id: validPaymentId });
      prismaMock.user.update.mockResolvedValue({ id: validUserId });

      const result = await service.activateSubscription(validUserId, {
        paymentId: validPaymentId,
        code: validCode,
      });

      expect(result.success).toBe(true);
      expect(result.subscription.status).toBe("ACTIVE");
      expect(result.subscription.plan).toBe("PROFESSIONAL");
      expect(prismaMock.paymentActivationCode.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ usedAt: expect.any(Date) }),
        }),
      );
      expect(prismaMock.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ planTier: "PROFESSIONAL" }),
        }),
      );
    });

    it("deve rejeitar código incorreto e incrementar contador de tentativas", async () => {
      prismaMock.payment.findUnique.mockResolvedValue({
        id: validPaymentId,
        userId: validUserId,
        plan: "PROFESSIONAL",
        status: "PAID",
        activationCode: {
          id: "act-1",
          codeHash: validHash,
          attempts: 1,
          usedAt: null,
          expiresAt: new Date(Date.now() + 20 * 60 * 1000),
        },
      });

      await expect(
        service.activateSubscription(validUserId, {
          paymentId: validPaymentId,
          code: "000000", // Código errado
        }),
      ).rejects.toThrow("Código de ativação inválido");

      expect(prismaMock.paymentActivationCode.update).toHaveBeenCalledWith({
        where: { id: "act-1" },
        data: { attempts: { increment: 1 } },
      });
    });

    it("deve rejeitar código quando exceder o limite de 5 tentativas", async () => {
      prismaMock.payment.findUnique.mockResolvedValue({
        id: validPaymentId,
        userId: validUserId,
        plan: "PROFESSIONAL",
        status: "PAID",
        activationCode: {
          id: "act-1",
          codeHash: validHash,
          attempts: 5, // Bloqueado
          usedAt: null,
          expiresAt: new Date(Date.now() + 20 * 60 * 1000),
        },
      });

      await expect(
        service.activateSubscription(validUserId, {
          paymentId: validPaymentId,
          code: validCode,
        }),
      ).rejects.toThrow(HttpException);
    });

    it("deve rejeitar código expirado", async () => {
      prismaMock.payment.findUnique.mockResolvedValue({
        id: validPaymentId,
        userId: validUserId,
        plan: "PROFESSIONAL",
        status: "PAID",
        activationCode: {
          id: "act-1",
          codeHash: validHash,
          attempts: 0,
          usedAt: null,
          expiresAt: new Date(Date.now() - 5 * 60 * 1000), // Expirou há 5 min
        },
      });

      await expect(
        service.activateSubscription(validUserId, {
          paymentId: validPaymentId,
          code: validCode,
        }),
      ).rejects.toThrow("Este código de ativação expirou");
    });

    it("deve rejeitar código já utilizado", async () => {
      prismaMock.payment.findUnique.mockResolvedValue({
        id: validPaymentId,
        userId: validUserId,
        plan: "PROFESSIONAL",
        status: "PAID",
        activationCode: {
          id: "act-1",
          codeHash: validHash,
          attempts: 0,
          usedAt: new Date(), // Já utilizado
          expiresAt: new Date(Date.now() + 20 * 60 * 1000),
        },
      });

      await expect(
        service.activateSubscription(validUserId, {
          paymentId: validPaymentId,
          code: validCode,
        }),
      ).rejects.toThrow("Este código de ativação já foi utilizado");
    });

    it("deve rejeitar código de outro usuário", async () => {
      prismaMock.payment.findUnique.mockResolvedValue({
        id: validPaymentId,
        userId: "outro-usuario",
        plan: "PROFESSIONAL",
        status: "PAID",
        activationCode: { id: "act-1" },
      });

      await expect(
        service.activateSubscription("usuario-atacante", {
          paymentId: validPaymentId,
          code: validCode,
        }),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe("Renovação e Cálculo de Expiração", () => {
    it("deve somar 30 dias na expiração existente ao renovar antes do vencimento", async () => {
      const now = new Date();
      // Assinatura atual vence daqui a 10 dias
      const currentExpiresAt = new Date(now.getTime() + 10 * 24 * 60 * 60 * 1000);

      prismaMock.payment.findUnique.mockResolvedValue({
        id: "pay-renew",
        userId: "user-1",
        plan: "PROFESSIONAL",
        status: "PAID",
        activationCode: {
          id: "act-renew",
          codeHash: createHash("sha256").update("user-1:pay-renew:123456").digest("hex"),
          attempts: 0,
          usedAt: null,
          expiresAt: new Date(now.getTime() + 20 * 60 * 1000),
        },
      });

      prismaMock.paymentActivationCode.update.mockResolvedValue({});
      prismaMock.subscription.findFirst.mockResolvedValue({
        id: "sub-existing",
        status: "ACTIVE",
        expiresAt: currentExpiresAt,
      });

      prismaMock.subscription.update.mockImplementation(({ data }) => ({
        id: "sub-existing",
        ...data,
      }));
      prismaMock.payment.update.mockResolvedValue({});
      prismaMock.user.update.mockResolvedValue({});

      await service.activateSubscription("user-1", {
        paymentId: "pay-renew",
        code: "123456",
      });

      // A nova data deve ser currentExpiresAt + 30 dias (ou seja, 40 dias no futuro)
      const expectedDaysAhead = 40;
      expect(prismaMock.subscription.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            expiresAt: expect.any(Date),
            renewalReminderSentAt: null,
          }),
        }),
      );

      const updatedCall = prismaMock.subscription.update.mock.calls[0][0];
      const newExpiresAt = updatedCall.data.expiresAt as Date;
      const diffDays = Math.round((newExpiresAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      expect(diffDays).toBe(expectedDaysAhead);
    });
  });

  describe("Expiração e Aviso de 3 Dias", () => {
    it("deve expirar assinatura vencida e voltar usuário para FREE", async () => {
      const pastDate = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000); // Venceu há 2 dias

      prismaMock.user.findUnique.mockResolvedValue({
        id: "user-exp",
        name: "Teste",
        email: "exp@email.com",
        planTier: "PROFESSIONAL",
      });

      prismaMock.subscription.findFirst.mockResolvedValue({
        id: "sub-exp",
        status: "ACTIVE",
        expiresAt: pastDate,
        plan: "PROFESSIONAL",
      });

      prismaMock.subscription.update.mockResolvedValue({});
      prismaMock.user.update.mockResolvedValue({});

      const result = await service.getMySubscription("user-exp");

      expect(result.hasActiveSubscription).toBe(false);
      expect(result.plan).toBe("FREE");
      expect(prismaMock.subscription.update).toHaveBeenCalledWith({
        where: { id: "sub-exp" },
        data: { status: "EXPIRED" },
      });
      expect(prismaMock.user.update).toHaveBeenCalledWith({
        where: { id: "user-exp" },
        data: { planTier: "FREE" },
      });
    });

    it("deve disparar aviso de 3 dias quando a assinatura estiver a 3 dias do fim", async () => {
      const now = new Date();
      // Vence daqui a 2 dias
      const nearFutureDate = new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000);

      prismaMock.user.findUnique.mockResolvedValue({
        id: "user-near",
        name: "Maria",
        email: "maria@email.com",
        planTier: "PROFESSIONAL",
      });

      prismaMock.subscription.findFirst.mockResolvedValue({
        id: "sub-near",
        status: "ACTIVE",
        expiresAt: nearFutureDate,
        plan: "PROFESSIONAL",
        renewalReminderSentAt: null, // Ainda não enviado
      });

      prismaMock.subscription.update.mockResolvedValue({});

      const result = await service.getMySubscription("user-near");

      expect(result.hasActiveSubscription).toBe(true);
      expect(result.subscription?.isExpiringSoon).toBe(true);
      expect(result.subscription?.daysRemaining).toBeLessThanOrEqual(3);

      expect(prismaMock.subscription.update).toHaveBeenCalledWith({
        where: { id: "sub-near" },
        data: { renewalReminderSentAt: expect.any(Date) },
      });
      expect(emailMock.sendRenewalReminderEmail).toHaveBeenCalled();
    });

    it("não deve duplicar o aviso de 3 dias se já tiver sido enviado", async () => {
      const now = new Date();
      const nearFutureDate = new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000);

      prismaMock.user.findUnique.mockResolvedValue({
        id: "user-near",
        name: "Maria",
        email: "maria@email.com",
        planTier: "PROFESSIONAL",
      });

      prismaMock.subscription.findFirst.mockResolvedValue({
        id: "sub-near",
        status: "ACTIVE",
        expiresAt: nearFutureDate,
        plan: "PROFESSIONAL",
        renewalReminderSentAt: new Date(now.getTime() - 24 * 60 * 60 * 1000), // Já foi enviado ontem!
      });

      await service.getMySubscription("user-near");

      // Não pode enviar novamente nem atualizar renewalReminderSentAt
      expect(prismaMock.subscription.update).not.toHaveBeenCalled();
      expect(emailMock.sendRenewalReminderEmail).not.toHaveBeenCalled();
    });
  });
});
