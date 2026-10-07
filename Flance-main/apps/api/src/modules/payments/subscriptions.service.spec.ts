import { createHmac } from "crypto";
import { BadRequestException, ForbiddenException, HttpException } from "@nestjs/common";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SubscriptionsService } from "./subscriptions.service";

const hash = (u: string, p: string, c: string) => createHmac("sha256", "s").update(`${u}:${p}:${c}`).digest("hex");

function setup() {
  const prisma: any = {
    payment: { findUnique: vi.fn(), update: vi.fn(), findFirst: vi.fn().mockResolvedValue(null) },
    paymentActivationCode: { updateMany: vi.fn() },
    subscription: { findFirst: vi.fn(), findUnique: vi.fn(), create: vi.fn(), update: vi.fn(), updateMany: vi.fn() },
    user: { findUnique: vi.fn(), update: vi.fn() },
    contractAcceptance: { findFirst: vi.fn().mockResolvedValue(null) },
  };
  prisma.$transaction = vi.fn((fn: any) => fn(prisma));
  const payments: any = {
    hashCode: vi.fn(hash),
    syncSubscriptionInvoices: vi.fn().mockResolvedValue([]),
    cancelOpenRenewalInvoices: vi.fn().mockResolvedValue(undefined),
    getPaymentById: vi.fn().mockResolvedValue({ paymentId: "inv-1" }),
  };
  const asaas: any = {
    createSubscription: vi.fn().mockResolvedValue({ id: "sub_asaas_1" }),
    deleteSubscription: vi.fn().mockResolvedValue(undefined),
  };
  return { service: new SubscriptionsService(prisma, payments, {} as any, asaas), prisma, payments, asaas };
}

const paidPayment = (over: any = {}) => ({
  id: "pay-1", userId: "user-1", plan: "PROFESSIONAL", status: "PAID", kind: "INITIAL",
  activationCode: { id: "ac-1", usedAt: null, attempts: 0, expiresAt: new Date("2026-10-02T14:00:00Z"), codeHash: hash("user-1", "pay-1", "123456") },
  ...over,
});

describe("SubscriptionsService", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-02T13:00:00Z")); // 10:00 de 02/10 em Brasília
  });
  afterEach(() => vi.useRealTimers());

  describe("activateSubscription", () => {
    function arrange(ctx: ReturnType<typeof setup>, payment = paidPayment()) {
      ctx.prisma.payment.findUnique.mockResolvedValue(payment);
      ctx.prisma.paymentActivationCode.updateMany.mockResolvedValue({ count: 1 });
      ctx.prisma.subscription.findFirst.mockResolvedValue(null);
      ctx.prisma.subscription.create.mockImplementation(async ({ data }: any) => ({ id: "sub-1", ...data }));
      ctx.prisma.subscription.findUnique.mockResolvedValue({
        id: "sub-1", plan: "PROFESSIONAL", status: "ACTIVE", cancelAtPeriodEnd: false, asaasSubscriptionId: null,
        expiresAt: new Date("2026-11-02T03:00:00Z"), billingAnchorDay: 2, user: { asaasCustomerId: "cus_1" },
      });
      ctx.prisma.subscription.updateMany.mockResolvedValue({ count: 1 });
    }

    it("ativa por 1 mês a partir da ATIVAÇÃO, publica a empresa e agenda a mensalidade no Asaas no mesmo dia do mês", async () => {
      const ctx = setup();
      arrange(ctx);

      const res: any = await ctx.service.activateSubscription("user-1", { paymentId: "pay-1", code: "123456" });

      expect(res.subscription.expiresAt).toBe("2026-11-02T03:00:00.000Z"); // ativou dia 2 -> vale até dia 2
      expect(ctx.prisma.subscription.create.mock.calls[0][0].data).toMatchObject({ billingAnchorDay: 2, recurringAmount: 29.99 });
      expect(ctx.prisma.user.update).toHaveBeenCalledWith({
        where: { id: "user-1" },
        data: expect.objectContaining({ planTier: "PROFESSIONAL", companyEnabled: true }),
      });
      expect(ctx.asaas.createSubscription).toHaveBeenCalledWith(
        expect.objectContaining({ customerId: "cus_1", value: 29.99, nextDueDate: "2026-11-02", externalReference: "sub-1" }),
      );
      expect(res.autoRenew).toBe(true);
    });

    it("ativação nos dias 29 a 31 renova no dia 28", async () => {
      const ctx = setup();
      vi.setSystemTime(new Date("2026-10-31T13:00:00Z"));
      arrange(ctx, paidPayment({ activationCode: { ...paidPayment().activationCode, expiresAt: new Date("2026-10-31T14:00:00Z") } }));
      const res: any = await ctx.service.activateSubscription("user-1", { paymentId: "pay-1", code: "123456" });
      expect(res.subscription.expiresAt).toBe("2026-11-28T03:00:00.000Z");
      expect(ctx.prisma.subscription.create.mock.calls[0][0].data.billingAnchorDay).toBe(28);
    });

    it("se o Asaas falhar, o plano continua ativado (a rotina diária tenta de novo)", async () => {
      const ctx = setup();
      arrange(ctx);
      ctx.asaas.createSubscription.mockRejectedValue(new Error("Asaas fora do ar"));
      const res: any = await ctx.service.activateSubscription("user-1", { paymentId: "pay-1", code: "123456" });
      expect(res.success).toBe(true);
      expect(res.autoRenew).toBe(false);
      // trava liberada para a próxima tentativa
      expect(ctx.prisma.subscription.update).toHaveBeenCalledWith({ where: { id: "sub-1" }, data: { billingSyncLockedAt: null } });
    });

    it("rejeita código incorreto e conta a tentativa", async () => {
      const ctx = setup();
      arrange(ctx);
      await expect(ctx.service.activateSubscription("user-1", { paymentId: "pay-1", code: "000000" })).rejects.toThrow(/inválido/);
      expect(ctx.prisma.paymentActivationCode.updateMany).toHaveBeenCalledWith(expect.objectContaining({ data: { attempts: { increment: 1 } } }));
      expect(ctx.prisma.subscription.create).not.toHaveBeenCalled();
    });

    it("bloqueia após 5 tentativas (429)", async () => {
      const ctx = setup();
      arrange(ctx, paidPayment({ activationCode: { ...paidPayment().activationCode, attempts: 5 } }));
      await expect(ctx.service.activateSubscription("user-1", { paymentId: "pay-1", code: "123456" })).rejects.toThrow(HttpException);
    });

    it("rejeita código expirado, já usado e pagamento de outro usuário", async () => {
      const ctx = setup();
      arrange(ctx, paidPayment({ activationCode: { ...paidPayment().activationCode, expiresAt: new Date("2026-10-02T12:00:00Z") } }));
      await expect(ctx.service.activateSubscription("user-1", { paymentId: "pay-1", code: "123456" })).rejects.toThrow(/expirou/);

      arrange(ctx, paidPayment({ activationCode: { ...paidPayment().activationCode, usedAt: new Date() } }));
      await expect(ctx.service.activateSubscription("user-1", { paymentId: "pay-1", code: "123456" })).rejects.toThrow(/já foi utilizado/);

      arrange(ctx, paidPayment({ userId: "outro" }));
      await expect(ctx.service.activateSubscription("user-1", { paymentId: "pay-1", code: "123456" })).rejects.toThrow(ForbiddenException);
    });

    it("não ativa se o pagamento ainda não foi confirmado", async () => {
      const ctx = setup();
      arrange(ctx, paidPayment({ status: "PENDING" }));
      await expect(ctx.service.activateSubscription("user-1", { paymentId: "pay-1", code: "123456" })).rejects.toThrow(BadRequestException);
    });
  });

  describe("ensureRecurringBilling", () => {
    const sub = (over: any = {}) => ({
      id: "sub-1", plan: "PROFESSIONAL_PLUS", status: "ACTIVE", cancelAtPeriodEnd: false, asaasSubscriptionId: null,
      expiresAt: new Date("2026-11-17T03:00:00Z"), billingAnchorDay: 17, user: { asaasCustomerId: "cus_1" }, ...over,
    });

    it("cria com o valor do plano e vencimento no fim do período pago", async () => {
      const ctx = setup();
      ctx.prisma.subscription.findUnique.mockResolvedValue(sub());
      ctx.prisma.subscription.updateMany.mockResolvedValue({ count: 1 });
      expect(await ctx.service.ensureRecurringBilling("sub-1")).toBe(true);
      expect(ctx.asaas.createSubscription).toHaveBeenCalledWith(expect.objectContaining({ value: 39.99, nextDueDate: "2026-11-17" }));
      expect(ctx.prisma.subscription.update.mock.calls[0][0].data).toMatchObject({ asaasSubscriptionId: "sub_asaas_1", recurringAmount: 39.99 });
    });

    it("logo após criar, busca as cobranças que o Asaas já gerou (o webhook pode ter chegado antes do id)", async () => {
      const ctx = setup();
      ctx.prisma.subscription.findUnique.mockResolvedValue(sub());
      ctx.prisma.subscription.updateMany.mockResolvedValue({ count: 1 });
      await ctx.service.ensureRecurringBilling("sub-1");
      expect(ctx.payments.syncSubscriptionInvoices).toHaveBeenCalledWith(expect.objectContaining({ id: "sub-1", asaasSubscriptionId: "sub_asaas_1" }));
    });

    it("falha na sincronização inicial não desfaz a criação da assinatura", async () => {
      const ctx = setup();
      ctx.prisma.subscription.findUnique.mockResolvedValue(sub());
      ctx.prisma.subscription.updateMany.mockResolvedValue({ count: 1 });
      ctx.payments.syncSubscriptionInvoices.mockRejectedValue(new Error("rede"));
      expect(await ctx.service.ensureRecurringBilling("sub-1")).toBe(true);
    });

    it("não cria duas vezes: já tem assinatura no Asaas, renovação cancelada ou trava ocupada", async () => {
      const ctx = setup();
      ctx.prisma.subscription.findUnique.mockResolvedValue(sub({ asaasSubscriptionId: "ja_existe" }));
      await ctx.service.ensureRecurringBilling("sub-1");
      ctx.prisma.subscription.findUnique.mockResolvedValue(sub({ cancelAtPeriodEnd: true }));
      await ctx.service.ensureRecurringBilling("sub-1");
      ctx.prisma.subscription.findUnique.mockResolvedValue(sub());
      ctx.prisma.subscription.updateMany.mockResolvedValue({ count: 0 }); // outra execução já pegou a trava
      expect(await ctx.service.ensureRecurringBilling("sub-1")).toBe(false);
      expect(ctx.asaas.createSubscription).not.toHaveBeenCalled();
    });
  });

  describe("cancelamento e reativação", () => {
    const active = { id: "sub-1", userId: "user-1", status: "ACTIVE", plan: "PROFESSIONAL", cancelAtPeriodEnd: false, asaasSubscriptionId: "sub_asaas_1", expiresAt: new Date("2026-10-20T03:00:00Z"), billingAnchorDay: 20 };

    it("cancelar remove a cobrança do Asaas, mas mantém o plano até o fim do período pago", async () => {
      const ctx = setup();
      ctx.prisma.subscription.findFirst.mockResolvedValue(active);
      ctx.prisma.user.findUnique.mockResolvedValue({ id: "user-1" });
      await ctx.service.cancelRenewal("user-1");
      expect(ctx.asaas.deleteSubscription).toHaveBeenCalledWith("sub_asaas_1");
      expect(ctx.prisma.subscription.update).toHaveBeenCalledWith({
        where: { id: "sub-1" },
        data: expect.objectContaining({ cancelAtPeriodEnd: true, asaasSubscriptionId: null }),
      });
      expect(ctx.payments.cancelOpenRenewalInvoices).toHaveBeenCalledWith("sub-1");
      expect(ctx.prisma.user.update).not.toHaveBeenCalled(); // continua no plano pago
    });

    it("se o Asaas recusar o cancelamento, NÃO marca como cancelado (não perde a cobrança)", async () => {
      const ctx = setup();
      ctx.prisma.subscription.findFirst.mockResolvedValue(active);
      ctx.asaas.deleteSubscription.mockRejectedValue(new Error("falha"));
      await expect(ctx.service.cancelRenewal("user-1")).rejects.toThrow();
      expect(ctx.prisma.subscription.update).not.toHaveBeenCalled();
    });

    it("reativar volta a agendar a cobrança mensal", async () => {
      const ctx = setup();
      const canceled = { ...active, cancelAtPeriodEnd: true, asaasSubscriptionId: null };
      ctx.prisma.subscription.findFirst.mockResolvedValue(canceled);
      ctx.prisma.subscription.findUnique.mockResolvedValue({ ...canceled, cancelAtPeriodEnd: false, user: { asaasCustomerId: "cus_1" } });
      ctx.prisma.subscription.updateMany.mockResolvedValue({ count: 1 });
      ctx.prisma.user.findUnique.mockResolvedValue({ id: "user-1" });
      await ctx.service.reactivateRenewal("user-1");
      expect(ctx.asaas.createSubscription).toHaveBeenCalledWith(expect.objectContaining({ nextDueDate: "2026-10-20" }));
    });

    it("não reativa um plano que já venceu", async () => {
      const ctx = setup();
      ctx.prisma.subscription.findFirst.mockResolvedValue({ ...active, cancelAtPeriodEnd: true, expiresAt: new Date("2026-10-01T00:00:00Z") });
      await expect(ctx.service.reactivateRenewal("user-1")).rejects.toThrow(BadRequestException);
    });
  });

  describe("pagar a mensalidade agora", () => {
    const active = { id: "sub-1", userId: "user-1", status: "ACTIVE", plan: "PROFESSIONAL", cancelAtPeriodEnd: false, asaasSubscriptionId: "sub_asaas_1", expiresAt: new Date("2026-10-20T03:00:00Z"), billingAnchorDay: 20 };

    it("devolve a mensalidade em aberto (mesmo antes do vencimento) para o cliente pagar", async () => {
      const ctx = setup();
      ctx.prisma.subscription.findFirst.mockResolvedValue(active);
      ctx.prisma.payment.findFirst.mockResolvedValue({ id: "inv-1" });
      const out = await ctx.service.renewSubscription("user-1");
      expect(ctx.payments.getPaymentById).toHaveBeenCalledWith("user-1", "inv-1");
      expect(out).toEqual({ paymentId: "inv-1" });
      expect(ctx.prisma.payment.findFirst.mock.calls[0][0].where.dueDate).toBeUndefined(); // sem janela de exibição
    });

    it("se ainda não chegou do Asaas, sincroniza antes de responder", async () => {
      const ctx = setup();
      ctx.prisma.subscription.findFirst.mockResolvedValue(active);
      ctx.prisma.payment.findFirst.mockResolvedValueOnce(null).mockResolvedValueOnce({ id: "inv-1" });
      await ctx.service.renewSubscription("user-1");
      expect(ctx.payments.syncSubscriptionInvoices).toHaveBeenCalled();
    });

    it("renovação cancelada: pede para reativar antes", async () => {
      const ctx = setup();
      ctx.prisma.subscription.findFirst.mockResolvedValue({ ...active, cancelAtPeriodEnd: true });
      await expect(ctx.service.renewSubscription("user-1")).rejects.toThrow(/Reative/);
    });
  });

  describe("minha assinatura e tolerância de atraso", () => {
    const base = { id: "sub-1", userId: "user-1", status: "ACTIVE", plan: "PROFESSIONAL", cancelAtPeriodEnd: false, asaasSubscriptionId: "sub_asaas_1", billingAnchorDay: 11, nextDueDate: null, canceledAt: null, startedAt: null, recurringAmount: 29.99 };

    async function run(expiresAt: string, cancel = false) {
      const ctx = setup();
      ctx.prisma.user.findUnique.mockResolvedValue({ id: "user-1" });
      ctx.prisma.subscription.findFirst.mockResolvedValue({ ...base, cancelAtPeriodEnd: cancel, expiresAt: new Date(expiresAt) });
      const res: any = await ctx.service.getMySubscription("user-1");
      return { ctx, res };
    }

    it("mostra a próxima renovação e só exibe a mensalidade em aberto quando está perto de vencer", async () => {
      const { ctx, res } = await run("2026-11-02T03:00:00Z");
      expect(res.billing).toMatchObject({ billingAnchorDay: 11, autoRenew: true, recurringScheduled: true, nextDueDate: "2026-11-02T03:00:00.000Z" });
      expect(ctx.prisma.payment.findFirst.mock.calls[0][0].where.dueDate.lte).toBeInstanceOf(Date); // janela de exibição
    });

    it("renovação cancelada: sem mensalidade em aberto", async () => {
      const { res } = await run("2026-10-20T03:00:00Z", true);
      expect(res.billing).toMatchObject({ autoRenew: false, cancelAtPeriodEnd: true, openInvoice: null });
    });

    it("venceu há 2 dias (dentro dos 3 de tolerância): continua ativo", async () => {
      vi.setSystemTime(new Date("2026-10-13T13:00:00Z"));
      const { ctx, res } = await run("2026-10-11T03:00:00Z");
      expect(res.hasActiveSubscription).toBe(true);
      expect(ctx.prisma.user.update).not.toHaveBeenCalled();
    });

    it("venceu há mais de 3 dias: cancela a cobrança no Asaas, o Pix em aberto e volta ao FREE", async () => {
      vi.setSystemTime(new Date("2026-10-15T13:00:00Z"));
      const { ctx, res } = await run("2026-10-11T03:00:00Z");
      expect(ctx.asaas.deleteSubscription).toHaveBeenCalledWith("sub_asaas_1");
      expect(ctx.payments.cancelOpenRenewalInvoices).toHaveBeenCalledWith("sub-1");
      expect(ctx.prisma.user.update).toHaveBeenCalledWith({ where: { id: "user-1" }, data: { planTier: "FREE" } });
      expect(res.hasActiveSubscription).toBe(false);
    });

    it("se o Asaas não cancelar, NÃO encerra o plano (a rotina tenta de novo)", async () => {
      vi.setSystemTime(new Date("2026-10-15T13:00:00Z"));
      const ctx = setup();
      ctx.asaas.deleteSubscription.mockRejectedValue(new Error("fora do ar"));
      ctx.prisma.user.findUnique.mockResolvedValue({ id: "user-1" });
      ctx.prisma.subscription.findFirst.mockResolvedValue({ ...base, expiresAt: new Date("2026-10-11T03:00:00Z") });
      const res: any = await ctx.service.getMySubscription("user-1");
      expect(ctx.prisma.user.update).not.toHaveBeenCalled();
      expect(res.hasActiveSubscription).toBe(true);
    });

    it("renovação cancelada: acaba exatamente no fim do período pago, sem tolerância", async () => {
      vi.setSystemTime(new Date("2026-10-11T14:00:00Z"));
      const { res } = await run("2026-10-11T13:00:00Z", true);
      expect(res.hasActiveSubscription).toBe(false);
    });
  });
});
