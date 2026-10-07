import { ConflictException, UnauthorizedException } from "@nestjs/common";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Prisma } from "@prisma/client";
import { PaymentsService } from "./payments.service";

const CPF = "529.982.247-25";
const TOKEN = "token-webhook-teste";

function setup() {
  const prisma: any = {
    payment: {
      create: vi.fn(), findUnique: vi.fn(), findUniqueOrThrow: vi.fn(), findFirst: vi.fn(), findMany: vi.fn(), update: vi.fn(), updateMany: vi.fn(),
    },
    user: { findUnique: vi.fn(), update: vi.fn() },
    subscription: { findFirst: vi.fn(), findUnique: vi.fn(), update: vi.fn() },
    paymentActivationCode: { upsert: vi.fn(), updateMany: vi.fn() },
    paymentWebhookEvent: { create: vi.fn(), updateMany: vi.fn(), update: vi.fn() },
  };
  prisma.$transaction = vi.fn((fn: any) => fn(prisma));
  const asaas: any = {
    findOrCreateCustomer: vi.fn().mockResolvedValue("cus_1"),
    createPixPayment: vi.fn(), getPixQrCode: vi.fn(), getPayment: vi.fn(),
    findPaymentsByExternalReference: vi.fn().mockResolvedValue([]),
    deletePayment: vi.fn().mockResolvedValue(undefined),
    listSubscriptionPayments: vi.fn().mockResolvedValue([]),
  };
  const email: any = {
    sendActivationCodeEmail: vi.fn().mockResolvedValue(true),
    sendRenewalConfirmedEmail: vi.fn().mockResolvedValue(true),
  };
  const contracts: any = {
    assertCurrent: vi.fn().mockReturnValue({ version: "v1", hash: "h".repeat(64) }),
    recordAcceptance: vi.fn().mockResolvedValue({ id: "acc-1" }),
  };
  const service = new PaymentsService(prisma, asaas, email, contracts);
  return { service, prisma, asaas, email, contracts };
}

const createInput = (plan = "PROFESSIONAL") => ({
  plan: plan as any,
  name: "João da Silva",
  email: "joao@email.com",
  cpf: CPF,
  acceptContract: true as const,
  contractVersion: "v1",
  contractHash: "h".repeat(64),
});

describe("PaymentsService", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-02T13:00:00Z")); // 10:00 em Brasília
    process.env.ASAAS_WEBHOOK_TOKEN = TOKEN;
    process.env.JWT_SECRET = "x".repeat(40);
  });
  afterEach(() => vi.useRealTimers());

  describe("getQuote", () => {
    it("simula o 1º pagamento: valor CHEIO, renovação no mesmo dia do mês (sem proporcional, sem dia 11)", () => {
      const { service } = setup();
      const quote = service.getQuote("PROFESSIONAL");
      expect(quote.initialAmount).toBe(29.99);
      expect(quote.recurringAmount).toBe(29.99);
      expect(quote.billingAnchorDay).toBe(2); // hoje é dia 2
      expect(quote.firstRenewalDate).toBe("2026-11-02T03:00:00.000Z");
    });

    it("recusa plano gratuito", () => {
      expect(() => setup().service.getQuote("FREE")).toThrow();
    });
  });

  describe("createPayment", () => {
    function arrange(ctx: ReturnType<typeof setup>, overrides: any = {}) {
      ctx.prisma.subscription.findFirst.mockResolvedValue(overrides.activeSubscription ?? null);
      ctx.prisma.user.findUnique.mockResolvedValue({
        id: "user-1", email: "joao@email.com", name: "João", asaasCustomerId: null, cpf: null, cpfEncrypted: null, emailVerifiedAt: new Date(),
      });
      ctx.prisma.payment.findUnique.mockResolvedValue(null);
      ctx.prisma.payment.create.mockImplementation(async ({ data }: any) => ({ id: "pay-1", createdAt: new Date(), ...data }));
      ctx.asaas.createPixPayment.mockResolvedValue({ id: "pay_asaas_1", dueDate: "2026-10-03" });
      ctx.asaas.getPixQrCode.mockResolvedValue({ encodedImage: "QR", payload: "000201...", expirationDate: "2026-10-03 23:59:59" });
      ctx.prisma.payment.update.mockImplementation(async ({ data }: any) => ({
        id: "pay-1", userId: "user-1", plan: "PROFESSIONAL", amount: 29.99, status: "PENDING", kind: "INITIAL", createdAt: new Date(), ...data,
      }));
    }

    it("cobra o valor CHEIO do plano e grava o aceite do contrato", async () => {
      const ctx = setup();
      arrange(ctx);

      const result = await ctx.service.createPayment("user-1", createInput(), "key-1", { ipAddress: "1.2.3.4", userAgent: "UA" });

      expect(ctx.prisma.payment.create.mock.calls[0][0].data).toMatchObject({ amount: 29.99, kind: "INITIAL", requestKey: "key-1" });
      expect(ctx.asaas.createPixPayment).toHaveBeenCalledWith(expect.objectContaining({ amount: 29.99, externalReference: "pay-1" }));
      expect(ctx.contracts.recordAcceptance).toHaveBeenCalledWith(
        expect.objectContaining({ userId: "user-1", paymentId: "pay-1", contractVersion: "v1", planPrice: 29.99, billingAnchorDay: 2, initialAmount: 29.99, ipAddress: "1.2.3.4", userAgent: "UA" }),
      );
      expect(result.pixCopyPaste).toBe("000201...");
    });

    it("o aceite é gravado ANTES de chamar o Asaas", async () => {
      const ctx = setup();
      arrange(ctx);
      await ctx.service.createPayment("user-1", createInput());
      expect(ctx.contracts.recordAcceptance.mock.invocationCallOrder[0]).toBeLessThan(ctx.asaas.createPixPayment.mock.invocationCallOrder[0]);
    });

    it("não cria cobrança se o contrato está desatualizado", async () => {
      const ctx = setup();
      arrange(ctx);
      ctx.contracts.assertCurrent.mockImplementation(() => { throw new ConflictException("contrato atualizado"); });
      await expect(ctx.service.createPayment("user-1", createInput())).rejects.toThrow(ConflictException);
      expect(ctx.prisma.payment.create).not.toHaveBeenCalled();
      expect(ctx.asaas.createPixPayment).not.toHaveBeenCalled();
    });

    it("bloqueia nova assinatura enquanto há uma ativa (evita cobrança duplicada)", async () => {
      const ctx = setup();
      arrange(ctx, { activeSubscription: { id: "sub-1", status: "ACTIVE", expiresAt: new Date("2026-10-11T03:00:00Z") } });
      await expect(ctx.service.createPayment("user-1", createInput())).rejects.toThrow(/assinatura ativa/);
      expect(ctx.asaas.createPixPayment).not.toHaveBeenCalled();
    });

    it("exige e-mail verificado", async () => {
      const ctx = setup();
      arrange(ctx);
      ctx.prisma.user.findUnique.mockResolvedValue({ id: "user-1", email: "joao@email.com", emailVerifiedAt: null });
      await expect(ctx.service.createPayment("user-1", createInput())).rejects.toThrow(/email/i);
    });

    it("não aceita valor vindo do cliente (o preço vem do servidor)", async () => {
      const ctx = setup();
      arrange(ctx);
      await ctx.service.createPayment("user-1", { ...createInput(), amount: 0.01 } as any);
      expect(ctx.asaas.createPixPayment).toHaveBeenCalledWith(expect.objectContaining({ amount: 29.99 }));
    });
  });

  describe("webhook", () => {
    const headers = { "asaas-access-token": TOKEN };
    const initialPayment = {
      id: "pay-1", userId: "user-1", plan: "PROFESSIONAL", amount: 29.99, status: "PENDING", kind: "INITIAL",
      providerPaymentId: "pay_asaas_1", providerSubscriptionId: null,
      user: { id: "user-1", email: "joao@email.com", name: "João", asaasCustomerId: "cus_1" },
    };

    function arrangeWebhook(ctx: ReturnType<typeof setup>) {
      ctx.prisma.paymentWebhookEvent.create.mockResolvedValue({});
      ctx.prisma.paymentWebhookEvent.update.mockResolvedValue({});
    }

    it("rejeita token inválido ou ausente", async () => {
      const { service } = setup();
      await expect(service.handleWebhook({ "asaas-access-token": "errado" }, { event: "X", payment: { id: "p" } })).rejects.toThrow(UnauthorizedException);
      await expect(service.handleWebhook({}, { event: "X", payment: { id: "p" } })).rejects.toThrow(UnauthorizedException);
    });

    it("1º pagamento recebido: confirma, gera código e envia e-mail", async () => {
      const ctx = setup();
      arrangeWebhook(ctx);
      ctx.prisma.payment.findUnique.mockResolvedValue(initialPayment);
      ctx.asaas.getPayment.mockResolvedValue({ id: "pay_asaas_1", status: "RECEIVED", value: 29.99, customer: "cus_1", externalReference: "pay-1" });
      ctx.prisma.payment.updateMany.mockResolvedValue({ count: 1 });

      const res: any = await ctx.service.handleWebhook(headers, { id: "evt_1", event: "PAYMENT_RECEIVED", payment: { id: "pay_asaas_1" } });

      expect(res).toMatchObject({ processed: true, status: "PAID" });
      expect(ctx.prisma.paymentActivationCode.upsert).toHaveBeenCalled();
      expect(ctx.email.sendActivationCodeEmail).toHaveBeenCalledTimes(1);
    });

    it("rejeita confirmação quando o valor no Asaas difere do valor local", async () => {
      const ctx = setup();
      arrangeWebhook(ctx);
      ctx.prisma.payment.findUnique.mockResolvedValue(initialPayment);
      ctx.asaas.getPayment.mockResolvedValue({ id: "pay_asaas_1", status: "RECEIVED", value: 0.5, customer: "cus_1", externalReference: "pay-1" });
      await expect(ctx.service.handleWebhook(headers, { id: "evt_2", event: "PAYMENT_RECEIVED", payment: { id: "pay_asaas_1" } })).rejects.toThrow();
      expect(ctx.prisma.paymentActivationCode.upsert).not.toHaveBeenCalled();
    });

    it("evento duplicado não é processado duas vezes", async () => {
      const ctx = setup();
      ctx.prisma.paymentWebhookEvent.create.mockRejectedValue(new Prisma.PrismaClientKnownRequestError("dup", { code: "P2002" } as any));
      ctx.prisma.paymentWebhookEvent.updateMany.mockResolvedValue({ count: 0 });
      const res: any = await ctx.service.handleWebhook(headers, { id: "evt_1", event: "PAYMENT_RECEIVED", payment: { id: "pay_asaas_1" } });
      expect(res.processed).toBe(false);
      expect(ctx.email.sendActivationCodeEmail).not.toHaveBeenCalled();
    });

    it("eventos que não são de cobrança (ex.: conta, transferência) são ignorados com sucesso", async () => {
      const { service, prisma } = setup();
      const res: any = await service.handleWebhook(headers, { id: "evt_acc", event: "ACCOUNT_STATUS_UPDATED", account: { id: "x" } });
      expect(res).toMatchObject({ received: true, ignored: true });
      expect(prisma.paymentWebhookEvent.create).not.toHaveBeenCalled();
    });

    it("cobrança que não é do Flance é ignorada com sucesso (não derruba a fila do Asaas)", async () => {
      const ctx = setup();
      arrangeWebhook(ctx);
      ctx.prisma.payment.findUnique.mockResolvedValue(null);
      const res: any = await ctx.service.handleWebhook(headers, { id: "evt_x", event: "PAYMENT_RECEIVED", payment: { id: "pay_alheio" } });
      expect(res).toMatchObject({ received: true, ignored: true });
      expect(ctx.prisma.paymentWebhookEvent.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: "PROCESSED" }) }));
    });

    it("OVERDUE marca PENDING como EXPIRED mas nunca rebaixa um pagamento pago", async () => {
      const ctx = setup();
      arrangeWebhook(ctx);
      ctx.prisma.payment.findUnique.mockResolvedValue(initialPayment);
      ctx.prisma.payment.updateMany.mockResolvedValue({ count: 0 });
      await ctx.service.handleWebhook(headers, { id: "evt_3", event: "PAYMENT_OVERDUE", payment: { id: "pay_asaas_1" } });
      expect(ctx.prisma.payment.updateMany).toHaveBeenCalledWith({ where: { id: "pay-1", status: "PENDING" }, data: { status: "EXPIRED" } });
    });

    it("DELETED não cancela pagamento já pago", async () => {
      const ctx = setup();
      arrangeWebhook(ctx);
      ctx.prisma.payment.findUnique.mockResolvedValue(initialPayment);
      ctx.prisma.payment.updateMany.mockResolvedValue({ count: 0 });
      await ctx.service.handleWebhook(headers, { id: "evt_4", event: "PAYMENT_DELETED", payment: { id: "pay_asaas_1" } });
      expect(ctx.prisma.payment.updateMany.mock.calls[0][0].where.status.in).toEqual(["PENDING", "EXPIRED"]);
    });
  });

  describe("mensalidade da assinatura do Asaas", () => {
    const dueDate = new Date("2026-11-02T03:00:00Z");
    const subscription = {
      id: "sub-1", userId: "user-1", plan: "PROFESSIONAL", asaasSubscriptionId: "sub_asaas_1", billingAnchorDay: 2,
      expiresAt: dueDate, status: "ACTIVE",
    };
    const remote = { id: "pay_r1", subscription: "sub_asaas_1", status: "RECEIVED", value: 29.99, customer: "cus_1", dueDate: "2026-11-02" };
    const localInvoice = {
      id: "inv-1", userId: "user-1", plan: "PROFESSIONAL", amount: 29.99, status: "PENDING", kind: "RECURRING",
      providerPaymentId: "pay_r1", providerSubscriptionId: "sub_asaas_1", subscriptionId: "sub-1",
      dueDate, coversUntil: new Date("2026-12-02T03:00:00Z"),
      subscription, user: { id: "user-1", email: "joao@email.com", name: "João", asaasCustomerId: "cus_1" },
    };
    const headers = { "asaas-access-token": TOKEN };

    function arrangeWebhook(ctx: ReturnType<typeof setup>) {
      ctx.prisma.paymentWebhookEvent.create.mockResolvedValue({});
      ctx.prisma.paymentWebhookEvent.update.mockResolvedValue({});
    }

    it("cobrança gerada pela assinatura vira mensalidade local e, paga, renova o plano até o mesmo dia do mês seguinte", async () => {
      const ctx = setup();
      arrangeWebhook(ctx);
      ctx.prisma.payment.findUnique
        .mockResolvedValueOnce(null)                  // resolveLocalPayment: por providerPaymentId
        .mockResolvedValueOnce(null)                  // upsertRecurringPayment: existing
        .mockResolvedValueOnce(localInvoice)          // resolveLocalPayment: após criar
        .mockResolvedValueOnce({ kind: "RECURRING" }) // processPaymentConfirmation: kind
        .mockResolvedValueOnce(localInvoice);         // confirmRecurringPayment: tx
      ctx.prisma.subscription.findUnique.mockResolvedValue(subscription);
      ctx.prisma.payment.create.mockResolvedValue(localInvoice);
      ctx.prisma.payment.updateMany.mockResolvedValue({ count: 1 });
      ctx.asaas.getPayment.mockResolvedValue(remote);

      const res: any = await ctx.service.handleWebhook(headers, {
        id: "evt_r1", event: "PAYMENT_RECEIVED", payment: { id: "pay_r1", subscription: "sub_asaas_1" },
      });

      const created = ctx.prisma.payment.create.mock.calls[0][0].data;
      expect(created).toMatchObject({ kind: "RECURRING", providerSubscriptionId: "sub_asaas_1", amount: 29.99, subscriptionId: "sub-1" });
      expect(created.coversUntil.toISOString()).toBe("2026-12-02T03:00:00.000Z");
      expect(res).toMatchObject({ processed: true, status: "PAID" });
      expect(ctx.prisma.subscription.update.mock.calls[0][0].data.expiresAt.toISOString()).toBe("2026-12-02T03:00:00.000Z");
      expect(ctx.prisma.user.update).toHaveBeenCalledWith({
        where: { id: "user-1" },
        data: expect.objectContaining({ planTier: "PROFESSIONAL", companyEnabled: true }),
      });
      expect(ctx.email.sendRenewalConfirmedEmail).toHaveBeenCalledTimes(1);
      expect(ctx.prisma.paymentActivationCode.upsert).not.toHaveBeenCalled(); // renovação não pede código
    });

    it("PAYMENT_CREATED apenas registra a cobrança do mês; não renova nada", async () => {
      const ctx = setup();
      arrangeWebhook(ctx);
      ctx.prisma.payment.findUnique
        .mockResolvedValueOnce(null).mockResolvedValueOnce(null).mockResolvedValueOnce(localInvoice);
      ctx.prisma.subscription.findUnique.mockResolvedValue(subscription);
      ctx.prisma.payment.create.mockResolvedValue(localInvoice);
      ctx.asaas.getPayment.mockResolvedValue({ ...remote, status: "PENDING" });

      await ctx.service.handleWebhook(headers, { id: "evt_c1", event: "PAYMENT_CREATED", payment: { id: "pay_r1", subscription: "sub_asaas_1" } });

      expect(ctx.prisma.payment.create).toHaveBeenCalledTimes(1);
      expect(ctx.prisma.subscription.update).not.toHaveBeenCalled();
      expect(ctx.email.sendRenewalConfirmedEmail).not.toHaveBeenCalled();
    });

    it("cobrança de assinatura que não é do Flance é ignorada", async () => {
      const ctx = setup();
      arrangeWebhook(ctx);
      ctx.prisma.payment.findUnique.mockResolvedValue(null);
      ctx.prisma.subscription.findUnique.mockResolvedValue(null);
      const res: any = await ctx.service.handleWebhook(headers, { id: "evt_x", event: "PAYMENT_CREATED", payment: { id: "pay_x", subscription: "sub_alheia" } });
      expect(res).toMatchObject({ received: true, ignored: true });
      expect(ctx.prisma.payment.create).not.toHaveBeenCalled();
    });

    it("pagamento em duplicidade não estende duas vezes", async () => {
      const ctx = setup();
      ctx.prisma.payment.findUnique.mockResolvedValue(localInvoice);
      ctx.prisma.payment.updateMany.mockResolvedValue({ count: 0 });
      const out = await ctx.service.processPaymentConfirmation("inv-1", remote as any);
      expect(out.newlyPaid).toBe(false);
      expect(ctx.prisma.subscription.update).not.toHaveBeenCalled();
      expect(ctx.email.sendRenewalConfirmedEmail).not.toHaveBeenCalled();
    });

    it("pagou tão tarde que o período já passou: conta um mês a partir de agora, no mesmo dia do mês", async () => {
      const ctx = setup(); // hoje: 02/10
      ctx.prisma.payment.findUnique.mockResolvedValue({
        ...localInvoice, coversUntil: new Date("2026-09-02T03:00:00Z"), subscription: { ...subscription, expiresAt: new Date("2026-08-02T03:00:00Z") },
      });
      ctx.prisma.payment.updateMany.mockResolvedValue({ count: 1 });
      await ctx.service.processPaymentConfirmation("inv-1", remote as any);
      expect(ctx.prisma.subscription.update.mock.calls[0][0].data.expiresAt.toISOString()).toBe("2026-11-02T03:00:00.000Z");
    });

    it("recusa se a cobrança do Asaas é de outra assinatura", async () => {
      const ctx = setup();
      ctx.prisma.payment.findUnique.mockResolvedValue(localInvoice);
      await expect(ctx.service.processPaymentConfirmation("inv-1", { ...remote, subscription: "sub_de_outro" } as any)).rejects.toThrow();
      expect(ctx.prisma.subscription.update).not.toHaveBeenCalled();
    });

    it("sincronização traz as cobranças pendentes e ignora as de outra assinatura", async () => {
      const ctx = setup();
      ctx.asaas.listSubscriptionPayments.mockResolvedValue([remote, { ...remote, id: "pay_outra", subscription: "sub_outra" }]);
      ctx.prisma.payment.findUnique.mockResolvedValue(null);
      ctx.prisma.payment.create.mockResolvedValue(localInvoice);
      const synced = await ctx.service.syncSubscriptionInvoices(subscription as any);
      expect(synced).toHaveLength(1);
      expect(ctx.prisma.payment.create).toHaveBeenCalledTimes(1);
    });

    describe("cancelamento das mensalidades em aberto", () => {
      it("cancela a cobrança no Asaas e marca como cancelada", async () => {
        const ctx = setup();
        ctx.prisma.payment.findMany.mockResolvedValue([localInvoice]);
        ctx.prisma.payment.updateMany.mockResolvedValue({ count: 1 });
        await ctx.service.cancelOpenRenewalInvoices("sub-1");
        expect(ctx.asaas.deletePayment).toHaveBeenCalledWith("pay_r1");
        expect(ctx.prisma.payment.updateMany).toHaveBeenCalledWith(expect.objectContaining({ data: { status: "CANCELED" } }));
      });

      it("se o Asaas recusar, mantém a cobrança (um pagamento posterior ainda é honrado)", async () => {
        const ctx = setup();
        ctx.prisma.payment.findMany.mockResolvedValue([localInvoice]);
        ctx.asaas.deletePayment.mockRejectedValue(new Error("Asaas fora do ar"));
        await expect(ctx.service.cancelOpenRenewalInvoices("sub-1")).resolves.toBeUndefined();
        expect(ctx.prisma.payment.updateMany).not.toHaveBeenCalled();
      });
    });
  });
});
