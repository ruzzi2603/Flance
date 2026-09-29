import { BadRequestException, UnauthorizedException } from "@nestjs/common";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AsaasService } from "./asaas.service";
import { PaymentEmailService } from "./payment-email.service";
import { PaymentsService } from "./payments.service";

describe("PaymentsService", () => {
  let service: PaymentsService;
  let prismaMock: any;
  let asaasMock: any;
  let emailMock: any;

  beforeEach(() => {
    vi.clearAllMocks();

    prismaMock = {
      user: {
        findUnique: vi.fn(),
        update: vi.fn(),
      },
      payment: {
        create: vi.fn(),
        findUnique: vi.fn(),
        update: vi.fn(),
      },
      paymentActivationCode: {
        upsert: vi.fn(),
      },
    };

    asaasMock = {
      findOrCreateCustomer: vi.fn(),
      createPixPayment: vi.fn(),
      getPixQrCode: vi.fn(),
      getPayment: vi.fn(),
    };

    emailMock = {
      sendActivationCodeEmail: vi.fn().mockResolvedValue(true),
      sendRenewalReminderEmail: vi.fn().mockResolvedValue(true),
    };

    service = new PaymentsService(prismaMock, asaasMock, emailMock);
  });

  describe("Criação de Pagamento Pix", () => {
    const validPayer = {
      name: "João Silva",
      email: "joao@email.com",
      cpf: "52998224725",
    };

    it("deve criar pagamento de R$ 29,99 para o plano PROFESSIONAL", async () => {
      prismaMock.user.findUnique.mockResolvedValue({
        id: "user-1",
        name: "João Silva",
        email: "joao@email.com",
        asaasCustomerId: "cus_123",
      });

      asaasMock.findOrCreateCustomer.mockResolvedValue("cus_123");
      asaasMock.createPixPayment.mockResolvedValue({
        id: "pay_asaas_1",
        value: 29.99,
        dueDate: "2026-09-30",
      });
      asaasMock.getPixQrCode.mockResolvedValue({
        encodedImage: "base64-qr-image",
        payload: "pix-copia-e-cola-1",
        expirationDate: "2026-09-30 23:59:59",
      });

      prismaMock.payment.create.mockResolvedValue({
        id: "payment-db-1",
        status: "PENDING",
        amount: 29.99,
        plan: "PROFESSIONAL",
        dueDate: new Date("2026-09-30"),
      });

      const result = await service.createPayment("user-1", {
        plan: "PROFESSIONAL",
        ...validPayer,
      });

      expect(result.amount).toBe(29.99);
      expect(result.plan).toBe("PROFESSIONAL");
      expect(result.pixQrCode).toBe("base64-qr-image");
      expect(result.pixCopyPaste).toBe("pix-copia-e-cola-1");

      // Garante que o valor passado ao Asaas é o determinado pelo backend (R$ 29.99)
      expect(asaasMock.createPixPayment).toHaveBeenCalledWith(
        expect.objectContaining({
          amount: 29.99,
          customerId: "cus_123",
        }),
      );
    });

    it("deve criar pagamento de R$ 39,99 para o plano PROFESSIONAL_PLUS", async () => {
      prismaMock.user.findUnique.mockResolvedValue({
        id: "user-2",
        name: "Maria Santos",
        email: "maria@email.com",
        asaasCustomerId: null,
      });

      asaasMock.findOrCreateCustomer.mockResolvedValue("cus_456");
      asaasMock.createPixPayment.mockResolvedValue({
        id: "pay_asaas_2",
        value: 39.99,
        dueDate: "2026-09-30",
      });
      asaasMock.getPixQrCode.mockResolvedValue({
        encodedImage: "base64-qr-image-2",
        payload: "pix-copia-e-cola-2",
        expirationDate: "2026-09-30 23:59:59",
      });

      prismaMock.payment.create.mockResolvedValue({
        id: "payment-db-2",
        status: "PENDING",
        amount: 39.99,
        plan: "PROFESSIONAL_PLUS",
        dueDate: new Date("2026-09-30"),
      });

      const result = await service.createPayment("user-2", {
        plan: "PROFESSIONAL_PLUS",
        ...validPayer,
      });

      expect(result.amount).toBe(39.99);
      expect(result.plan).toBe("PROFESSIONAL_PLUS");
      expect(asaasMock.createPixPayment).toHaveBeenCalledWith(
        expect.objectContaining({
          amount: 39.99,
        }),
      );
    });

    it("deve impedir plano inválido", async () => {
      await expect(
        service.createPayment("user-1", {
          plan: "INVALID_PLAN",
          ...validPayer,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it("deve impedir criação de pagamento para o plano FREE", async () => {
      await expect(
        service.createPayment("user-1", {
          plan: "FREE",
          ...validPayer,
        }),
      ).rejects.toThrow("O plano FREE não necessita de pagamento");
    });

    it("deve impedir alteração do preço pelo frontend", async () => {
      prismaMock.user.findUnique.mockResolvedValue({
        id: "user-1",
        name: "João Silva",
        email: "joao@email.com",
      });
      asaasMock.findOrCreateCustomer.mockResolvedValue("cus_123");
      asaasMock.createPixPayment.mockResolvedValue({ id: "pay_1", value: 29.99 });
      asaasMock.getPixQrCode.mockResolvedValue({ encodedImage: "img", payload: "code" });
      prismaMock.payment.create.mockResolvedValue({ id: "p1", status: "PENDING", amount: 29.99, plan: "PROFESSIONAL" });

      // Mesmo que o input tenha qualquer outra propriedade, o backend ignora e usa 29.99
      const result = await service.createPayment("user-1", {
        plan: "PROFESSIONAL",
        ...validPayer,
        // @ts-expect-error teste de tentativa de injeção de preço
        price: 0.01,
      });

      expect(result.amount).toBe(29.99);
      expect(asaasMock.createPixPayment).toHaveBeenCalledWith(
        expect.objectContaining({ amount: 29.99 }),
      );
    });
  });

  describe("Webhook do Asaas e Idempotência", () => {
    it("deve confirmar pagamento, gerar código e enviar e-mail", async () => {
      prismaMock.payment.findUnique.mockResolvedValue({
        id: "pay-db-1",
        userId: "user-1",
        plan: "PROFESSIONAL",
        status: "PENDING",
        providerPaymentId: "pay_asaas_1",
        user: { id: "user-1", name: "João Silva", email: "joao@email.com" },
      });

      prismaMock.payment.update.mockResolvedValue({ id: "pay-db-1", status: "PAID" });
      prismaMock.paymentActivationCode.upsert.mockResolvedValue({ id: "code-1" });

      const response = await service.handleWebhook(
        {},
        {
          event: "PAYMENT_RECEIVED",
          payment: { id: "pay_asaas_1", status: "RECEIVED" },
        },
      );

      expect(response.received).toBe(true);
      expect(response.status).toBe("PAID");
      expect(prismaMock.payment.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: "PAID" }),
        }),
      );
      expect(prismaMock.paymentActivationCode.upsert).toHaveBeenCalled();
      expect(emailMock.sendActivationCodeEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: "joao@email.com",
          planName: "Profissional",
        }),
      );
    });

    it("deve ser estritamente idempotente em webhooks duplicados", async () => {
      prismaMock.payment.findUnique.mockResolvedValue({
        id: "pay-db-1",
        status: "PAID", // Já está pago!
        providerPaymentId: "pay_asaas_1",
        user: { id: "user-1", name: "João", email: "joao@email.com" },
      });

      const response = await service.handleWebhook(
        {},
        {
          event: "PAYMENT_CONFIRMED",
          payment: { id: "pay_asaas_1" },
        },
      );

      expect(response.received).toBe(true);
      expect(response.reason).toBe("Already paid");
      // Não pode reatualizar nem reemitir e-mail!
      expect(prismaMock.payment.update).not.toHaveBeenCalled();
      expect(emailMock.sendActivationCodeEmail).not.toHaveBeenCalled();
    });

    it("deve atualizar pagamento para EXPIRED no evento PAYMENT_OVERDUE", async () => {
      prismaMock.payment.findUnique.mockResolvedValue({
        id: "pay-db-1",
        status: "PENDING",
        providerPaymentId: "pay_asaas_1",
      });

      const response = await service.handleWebhook(
        {},
        {
          event: "PAYMENT_OVERDUE",
          payment: { id: "pay_asaas_1" },
        },
      );

      expect(response.status).toBe("EXPIRED");
      expect(prismaMock.payment.update).toHaveBeenCalledWith({
        where: { id: "pay-db-1" },
        data: { status: "EXPIRED" },
      });
    });

    it("deve tratar pagamento não encontrado sem quebrar", async () => {
      prismaMock.payment.findUnique.mockResolvedValue(null);

      const response = await service.handleWebhook(
        {},
        {
          event: "PAYMENT_CONFIRMED",
          payment: { id: "pay_unknown" },
        },
      );

      expect(response.received).toBe(true);
      expect(response.ignored).toBe(true);
    });
  });
});
