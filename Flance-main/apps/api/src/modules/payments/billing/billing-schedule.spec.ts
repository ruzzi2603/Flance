import { describe, expect, it } from "vitest";
import {
  addBillingMonth,
  computeAnchorDay,
  computeInitialCharge,
  fromAsaasDate,
  getAccessDeadline,
  toAsaasDate,
} from "./billing-schedule";

const at = (iso: string) => new Date(`${iso}-03:00`); // horário de Brasília

describe("billing-schedule (mensal, no dia da ativação)", () => {
  it("renova no mesmo dia do mês da ativação", () => {
    expect(computeAnchorDay(at("2026-10-02T15:00:00"))).toBe(2);
    expect(toAsaasDate(addBillingMonth(at("2026-10-02T15:00:00"), 2))).toBe("2026-11-02");
    expect(toAsaasDate(addBillingMonth(at("2026-10-17T09:00:00"), 17))).toBe("2026-11-17");
  });

  it("ativações nos dias 29, 30 e 31 renovam no dia 28 (nem todo mês tem esses dias)", () => {
    for (const day of ["29", "30", "31"]) expect(computeAnchorDay(at(`2026-10-${day}T10:00:00`))).toBe(28);
    expect(toAsaasDate(addBillingMonth(at("2026-01-31T10:00:00"), 28))).toBe("2026-02-28");
  });

  it("vira o ano", () => {
    expect(toAsaasDate(addBillingMonth(at("2026-12-20T10:00:00"), 20))).toBe("2027-01-20");
  });

  it("1º pagamento é o valor CHEIO (sem proporcional) e a 1ª renovação é daqui a 1 mês", () => {
    const charge = computeInitialCharge(at("2026-10-10T09:00:00"), 29.99);
    expect(charge).toMatchObject({ initialAmount: 29.99, recurringAmount: 29.99, billingAnchorDay: 10 });
    expect(toAsaasDate(charge.firstRenewalDate)).toBe("2026-11-10");
  });

  it("respeita o fuso de Brasília perto da meia-noite UTC", () => {
    // 22:30 em Brasília = 01:30 UTC do dia seguinte: ainda é dia 10 no Brasil
    expect(computeAnchorDay(at("2026-10-10T22:30:00"))).toBe(10);
    expect(toAsaasDate(at("2026-10-10T22:30:00"))).toBe("2026-10-10");
  });

  it("converte datas do Asaas para meia-noite de Brasília", () => {
    expect(fromAsaasDate("2026-11-02").toISOString()).toBe("2026-11-02T03:00:00.000Z");
  });

  it("tolerância de 3 dias após o vencimento", () => {
    expect(toAsaasDate(getAccessDeadline(at("2026-11-02T00:00:00")))).toBe("2026-11-05");
  });
});
