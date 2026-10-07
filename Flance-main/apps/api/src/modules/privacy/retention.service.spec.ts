import { describe, expect, it, vi } from "vitest";
import { RetentionService } from "./retention.service";

const NOW = new Date("2026-10-04T12:00:00Z");

function setup() {
  const prisma: any = {
    refreshToken: { deleteMany: vi.fn().mockResolvedValue({ count: 4 }) },
    passwordReset: { deleteMany: vi.fn().mockResolvedValue({ count: 2 }) },
    paymentActivationCode: { deleteMany: vi.fn().mockResolvedValue({ count: 1 }) },
    paymentWebhookEvent: { deleteMany: vi.fn().mockResolvedValue({ count: 7 }) },
    adminAuditLog: { updateMany: vi.fn().mockResolvedValue({ count: 3 }) },
    user: { findMany: vi.fn().mockResolvedValue([]), delete: vi.fn() },
    payment: { aggregate: vi.fn(), deleteMany: vi.fn() },
    contractAcceptance: { aggregate: vi.fn(), deleteMany: vi.fn() },
    subscription: { aggregate: vi.fn(), deleteMany: vi.fn() },
  };
  prisma.$transaction = vi.fn((fn: any) => fn(prisma));
  return { service: new RetentionService(prisma), prisma };
}

const dates = (p: string | null, c: string | null, s: string | null) => (prisma: any) => {
  prisma.payment.aggregate.mockResolvedValue({ _max: { createdAt: p ? new Date(p) : null } });
  prisma.contractAcceptance.aggregate.mockResolvedValue({ _max: { acceptedAt: c ? new Date(c) : null } });
  prisma.subscription.aggregate.mockResolvedValue({ _max: { updatedAt: s ? new Date(s) : null } });
};

describe("RetentionService", () => {
  it("apaga tokens, códigos e eventos vencidos e anonimiza logs antigos", async () => {
    const { service, prisma } = setup();
    const stats = await service.run(NOW);

    expect(stats).toMatchObject({ refreshTokens: 4, passwordResets: 2, unusedActivationCodes: 1, webhookEvents: 7, auditLogsRedacted: 3, errors: 0 });
    // códigos USADOS (prova de ativação) nunca são apagados
    expect(prisma.paymentActivationCode.deleteMany.mock.calls[0][0].where.usedAt).toBeNull();
    // eventos de webhook: só com mais de 5 anos
    expect(prisma.paymentWebhookEvent.deleteMany.mock.calls[0][0].where.receivedAt.lt.toISOString()).toBe("2021-10-04T12:00:00.000Z");
    expect(prisma.adminAuditLog.updateMany.mock.calls[0][0].data).toEqual({ targetEmail: "[removido]", targetName: "[removido]" });
  });

  it("conta anonimizada com registro financeiro de menos de 5 anos é MANTIDA", async () => {
    const { service, prisma } = setup();
    prisma.user.findMany.mockResolvedValue([{ id: "u1", email: "removido+u1@excluido.invalid" }]);
    dates("2024-03-01", "2024-03-01", "2025-01-01")(prisma);
    const stats = await service.run(NOW);
    expect(stats.anonymizedAccountsPurged).toBe(0);
    expect(prisma.user.delete).not.toHaveBeenCalled();
  });

  it("conta anonimizada com todos os registros com mais de 5 anos é apagada, provas incluídas", async () => {
    const { service, prisma } = setup();
    prisma.user.findMany.mockResolvedValue([{ id: "u1", email: "removido+u1@excluido.invalid" }]);
    dates("2020-01-10", "2020-01-10", "2021-02-01")(prisma);
    const stats = await service.run(NOW);
    expect(stats.anonymizedAccountsPurged).toBe(1);
    expect(prisma.payment.deleteMany).toHaveBeenCalledWith({ where: { userId: "u1" } });
    expect(prisma.contractAcceptance.deleteMany).toHaveBeenCalledWith({ where: { userId: "u1" } });
    expect(prisma.user.delete).toHaveBeenCalledWith({ where: { id: "u1" } });
  });

  it("um único registro recente basta para manter tudo (usa o mais novo)", async () => {
    const { service, prisma } = setup();
    prisma.user.findMany.mockResolvedValue([{ id: "u1", email: "removido+u1@excluido.invalid" }]);
    dates("2019-01-01", "2019-01-01", "2024-12-01")(prisma);
    expect((await service.run(NOW)).anonymizedAccountsPurged).toBe(0);
  });

  it("nunca apaga um usuário comum cujo e-mail só termina parecido", async () => {
    const { service, prisma } = setup();
    prisma.user.findMany.mockResolvedValue([{ id: "u2", email: "alguem@outro.com" }]);
    expect((await service.run(NOW)).anonymizedAccountsPurged).toBe(0);
    expect(prisma.user.delete).not.toHaveBeenCalled();
  });

  it("falha em uma etapa não interrompe as demais", async () => {
    const { service, prisma } = setup();
    prisma.refreshToken.deleteMany.mockRejectedValue(new Error("db"));
    const stats = await service.run(NOW);
    expect(stats.errors).toBe(1);
    expect(stats.passwordResets).toBe(2);
    expect(stats.webhookEvents).toBe(7);
  });
});
