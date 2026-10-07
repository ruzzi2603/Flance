import { ConflictException } from "@nestjs/common";
import { describe, expect, it, vi } from "vitest";
import { ContractsService } from "./contracts.service";
import { buildSubscriptionContract } from "./subscription-contract";

function setup() {
  const prisma: any = { contractAcceptance: { findUnique: vi.fn(), create: vi.fn(), findFirst: vi.fn() } };
  return { service: new ContractsService(prisma), prisma };
}

describe("Contrato de assinatura", () => {
  it("traz preços, mensalidade no dia da ativação, Pix, cancelamento e arrependimento", () => {
    const c = buildSubscriptionContract();
    const text = JSON.stringify(c.sections);
    expect(text).toContain("R$ 29,99");
    expect(text).toContain("R$ 39,99");
    expect(text).toContain("mesmo dia do mês");
    expect(text).toContain("valor cheio");
    expect(text).toContain("sem cobrança proporcional");
    expect(text).toContain("dia 28"); // ativações nos dias 29-31
    expect(text).not.toContain("todo dia 11");
    expect(text).toContain("Pix");
    expect(text).toContain("art. 49");
    expect(text).toContain("cancelar a renovação a qualquer momento");
    expect(c.hash).toMatch(/^[a-f0-9]{64}$/);
  });

  it("o hash é estável e muda quando o texto/dados mudam", () => {
    expect(buildSubscriptionContract().hash).toBe(buildSubscriptionContract().hash);
    process.env.COMPANY_CNPJ = "12.345.678/0001-90";
    const changed = buildSubscriptionContract().hash;
    delete process.env.COMPANY_CNPJ;
    expect(changed).not.toBe(buildSubscriptionContract().hash);
  });

  it("só aceita a versão e o hash EXATOS do texto vigente", () => {
    const { service } = setup();
    const c = service.getSubscriptionContract();
    expect(service.assertCurrent(c.version, c.hash).hash).toBe(c.hash);
    expect(() => service.assertCurrent(c.version, "0".repeat(64))).toThrow(ConflictException);
    expect(() => service.assertCurrent("1999-01-01.1", c.hash)).toThrow(ConflictException);
    expect(() => service.assertCurrent(undefined, undefined)).toThrow(ConflictException);
  });

  it("grava o aceite com o texto exato (snapshot), IP e navegador; é idempotente por pagamento", async () => {
    const { service, prisma } = setup();
    const c = service.getSubscriptionContract();
    prisma.contractAcceptance.findUnique.mockResolvedValueOnce(null);
    prisma.contractAcceptance.create.mockResolvedValue({ id: "acc-1" });

    await service.recordAcceptance({
      userId: "u1", paymentId: "p1", contractVersion: c.version, contractHash: c.hash, plan: "PROFESSIONAL",
      planPrice: 29.99, billingAnchorDay: 2, initialAmount: 29.99, ipAddress: "1.2.3.4", userAgent: "UA",
    });
    const data = prisma.contractAcceptance.create.mock.calls[0][0].data;
    expect(data).toMatchObject({ userId: "u1", paymentId: "p1", contractHash: c.hash, ipAddress: "1.2.3.4", userAgent: "UA" });
    expect((data.contractSnapshot as any).hash).toBe(c.hash);

    prisma.contractAcceptance.findUnique.mockResolvedValueOnce({ id: "acc-1" });
    await service.recordAcceptance({ userId: "u1", paymentId: "p1", contractVersion: c.version, contractHash: c.hash, plan: "PROFESSIONAL", planPrice: 29.99, billingAnchorDay: 2, initialAmount: 29.99 });
    expect(prisma.contractAcceptance.create).toHaveBeenCalledTimes(1);
  });

  it("remete às Políticas de Pagamentos e de Privacidade (integram o contrato)", () => {
    const text = JSON.stringify(buildSubscriptionContract().sections);
    expect(text).toContain("/pagamentos");
    expect(text).toContain("/privacidade");
  });

  it("e-mail do Encarregado (DPO): usa COMPANY_PRIVACY_EMAIL, senão o de suporte", () => {
    process.env.COMPANY_SUPPORT_EMAIL = "suporte@flance.com";
    delete process.env.COMPANY_PRIVACY_EMAIL;
    expect(buildSubscriptionContract().company.privacyEmail).toBe("suporte@flance.com");

    process.env.COMPANY_PRIVACY_EMAIL = "dpo@flance.com";
    const contract = buildSubscriptionContract();
    expect(contract.company.privacyEmail).toBe("dpo@flance.com");
    expect(JSON.stringify(contract.sections)).toContain("dpo@flance.com");

    delete process.env.COMPANY_SUPPORT_EMAIL;
    delete process.env.COMPANY_PRIVACY_EMAIL;
  });
});
