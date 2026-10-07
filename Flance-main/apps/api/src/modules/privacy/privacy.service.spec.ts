import bcrypt from "bcryptjs";
import { ForbiddenException } from "@nestjs/common";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { encryptCpf } from "../payments/utils/cpf-crypto";
import { PrivacyService } from "./privacy.service";

function setup() {
  const prisma: any = {
    user: { findUnique: vi.fn(), update: vi.fn(), delete: vi.fn() },
    payment: { count: vi.fn().mockResolvedValue(0), findMany: vi.fn().mockResolvedValue([]), updateMany: vi.fn() },
    subscription: { count: vi.fn().mockResolvedValue(0), findMany: vi.fn().mockResolvedValue([]), updateMany: vi.fn() },
    contractAcceptance: { count: vi.fn().mockResolvedValue(0), findMany: vi.fn().mockResolvedValue([]) },
    refreshToken: { deleteMany: vi.fn() },
    passwordReset: { deleteMany: vi.fn() },
    conversation: { findMany: vi.fn().mockResolvedValue([]), deleteMany: vi.fn(), count: vi.fn().mockResolvedValue(2) },
    message: { deleteMany: vi.fn(), findMany: vi.fn().mockResolvedValue([{ id: "m1", body: "oi" }]) },
    companyReview: { deleteMany: vi.fn(), findMany: vi.fn().mockResolvedValue([]) },
    companyAnalyticsEvent: { deleteMany: vi.fn() },
    badge: { deleteMany: vi.fn(), findMany: vi.fn().mockResolvedValue([]) },
    proposal: { deleteMany: vi.fn(), findMany: vi.fn().mockResolvedValue([]) },
    job: { deleteMany: vi.fn(), findMany: vi.fn().mockResolvedValue([]) },
  };
  prisma.$transaction = vi.fn((fn: any) => fn(prisma));
  const subscriptions: any = { expireSubscription: vi.fn().mockResolvedValue(true) };
  return { service: new PrivacyService(prisma, subscriptions), prisma, subscriptions };
}

describe("PrivacyService", () => {
  const hash = bcrypt.hashSync("senha-correta", 4);
  let ctx: ReturnType<typeof setup>;

  beforeEach(() => {
    process.env.JWT_SECRET = "x".repeat(40);
    ctx = setup();
  });

  const loginUser = (role = "USER") => ctx.prisma.user.findUnique.mockResolvedValue({ id: "u1", role, password: hash });

  describe("exportData", () => {
    it("exige a senha (reautenticação)", async () => {
      loginUser();
      await expect(ctx.service.exportData("u1", "errada")).rejects.toThrow(ForbiddenException);
      expect(ctx.prisma.payment.findMany).not.toHaveBeenCalled();
    });

    it("exporta os dados do titular sem hash de senha, sem CPF completo e com CPF mascarado", async () => {
      ctx.prisma.user.findUnique
        .mockResolvedValueOnce({ id: "u1", role: "USER", password: hash }) // assertPassword
        .mockResolvedValueOnce({ id: "u1", email: "a@a.com", name: "Ana", cpfEncrypted: encryptCpf("52998224725"), createdAt: new Date() });
      ctx.prisma.payment.findMany.mockResolvedValue([{ id: "p1", amount: 9, status: "PAID" }]);

      const out: any = await ctx.service.exportData("u1", "senha-correta");

      expect(out.account.cpf).toBe("***.***.***-25");
      expect(JSON.stringify(out)).not.toContain("52998224725");
      expect(out.account.cpfEncrypted).toBeUndefined();
      expect(out.account.password).toBeUndefined();
      expect(out.billing.payments).toHaveLength(1);
      expect(out.activity.messagesSent).toHaveLength(1);
      expect(out.activity.conversationsCount).toBe(2);
      expect(out.format).toBe("flance-data-export/1");
    });

    it("só consulta dados do próprio usuário", async () => {
      ctx.prisma.user.findUnique.mockResolvedValue({ id: "u1", role: "USER", password: hash, cpfEncrypted: null });
      await ctx.service.exportData("u1", "senha-correta");
      for (const m of [ctx.prisma.payment.findMany, ctx.prisma.subscription.findMany, ctx.prisma.contractAcceptance.findMany]) {
        expect(m.mock.calls[0][0].where).toEqual({ userId: "u1" });
      }
      expect(ctx.prisma.message.findMany.mock.calls[0][0].where).toEqual({ senderId: "u1" });
    });
  });

  describe("deleteAccount", () => {
    it("senha errada: nada é apagado", async () => {
      loginUser();
      await expect(ctx.service.deleteAccount("u1", "errada")).rejects.toThrow(ForbiddenException);
      expect(ctx.prisma.$transaction).not.toHaveBeenCalled();
    });

    it("administrador não pode se excluir por aqui", async () => {
      loginUser("ADMIN");
      await expect(ctx.service.deleteAccount("u1", "senha-correta")).rejects.toThrow(/administrador/i);
      expect(ctx.prisma.user.delete).not.toHaveBeenCalled();
    });

    it("sem histórico financeiro: exclusão total", async () => {
      loginUser();
      const res = await ctx.service.deleteAccount("u1", "senha-correta");
      expect(res).toEqual({ deleted: true, anonymized: false });
      expect(ctx.prisma.user.delete).toHaveBeenCalledWith({ where: { id: "u1" } });
      expect(ctx.prisma.user.update).not.toHaveBeenCalled();
      expect(ctx.subscriptions.expireSubscription).not.toHaveBeenCalled();
    });

    it("com histórico financeiro: anonimiza, apaga o conteúdo e NÃO apaga pagamentos/aceites", async () => {
      loginUser();
      ctx.prisma.payment.count.mockResolvedValue(3);
      ctx.prisma.conversation.findMany.mockResolvedValue([{ id: "c1" }]);
      ctx.prisma.subscription.findMany.mockResolvedValue([{ id: "s1", status: "ACTIVE", asaasSubscriptionId: "sub_1" }]);

      const res = await ctx.service.deleteAccount("u1", "senha-correta");

      expect(res).toEqual({ deleted: true, anonymized: true });
      expect(ctx.prisma.user.delete).not.toHaveBeenCalled();
      const data = ctx.prisma.user.update.mock.calls[0][0].data;
      expect(data).toMatchObject({ name: "Usuário removido", cpf: null, cpfEncrypted: null, companyEnabled: false, email: "removido+u1@excluido.invalid" });
      // conteúdo e credenciais
      expect(ctx.prisma.refreshToken.deleteMany).toHaveBeenCalled();
      expect(ctx.prisma.message.deleteMany).toHaveBeenCalled();
      expect(ctx.prisma.conversation.deleteMany).toHaveBeenCalledWith({ where: { id: { in: ["c1"] } } });
      expect(ctx.prisma.companyReview.deleteMany).toHaveBeenCalled();
      // Pix pendente cancelado; plano encerrado; cobrança do Asaas cancelada na hora
      expect(ctx.prisma.payment.updateMany).toHaveBeenCalledWith({ where: { userId: "u1", status: "PENDING" }, data: { status: "CANCELED" } });
      expect(ctx.prisma.subscription.updateMany).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ cancelAtPeriodEnd: true }) }));
      expect(ctx.subscriptions.expireSubscription).toHaveBeenCalledWith(expect.objectContaining({ id: "s1" }));
    });

    it("falha ao cancelar no Asaas não impede a exclusão (a rotina diária repete)", async () => {
      loginUser();
      ctx.prisma.subscription.count.mockResolvedValue(1);
      ctx.prisma.subscription.findMany.mockResolvedValue([{ id: "s1" }]);
      ctx.subscriptions.expireSubscription.mockRejectedValue(new Error("Asaas fora do ar"));
      await expect(ctx.service.deleteAccount("u1", "senha-correta")).resolves.toMatchObject({ anonymized: true });
    });
  });
});
