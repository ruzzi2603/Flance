/**
 * Calendário de cobrança: mensalidade no MESMO DIA DO MÊS da ativação do plano (fuso de Brasília).
 * Sem dia fixo e sem valor proporcional. O primeiro pagamento é o valor cheio e cobre o primeiro mês.
 *
 * O dia de renovação vai de 1 a 28: ativações nos dias 29, 30 e 31 renovam no dia 28, porque nem todo mês
 * tem esses dias. Funções puras (sem I/O) para serem fáceis de testar.
 */

export const MAX_ANCHOR_DAY = 28;
/** Dias de tolerância após o vencimento antes de voltar o usuário ao plano gratuito. */
export const GRACE_DAYS = 3;
/** A renovação em aberto só aparece em "Minha assinatura" quando falta tão pouco para vencer. */
export const OPEN_INVOICE_DISPLAY_DAYS = 10;

export const DAY_MS = 24 * 60 * 60 * 1000;
const BRASILIA_OFFSET_MS = -3 * 60 * 60 * 1000; // sem horário de verão desde 2019

function brasiliaParts(date: Date) {
  const shifted = new Date(date.getTime() + BRASILIA_OFFSET_MS);
  return { year: shifted.getUTCFullYear(), month: shifted.getUTCMonth(), day: shifted.getUTCDate() };
}

/** 00:00 (Brasília) do dia informado */
function brasiliaMidnight(year: number, month: number, day: number): Date {
  return new Date(Date.UTC(year, month, day, 3, 0, 0));
}

/** Dia do mês (Brasília) em que a assinatura renova: o dia da ativação, no máximo 28 */
export function computeAnchorDay(activatedAt: Date): number {
  return Math.min(brasiliaParts(activatedAt).day, MAX_ANCHOR_DAY);
}

/** Mesmo dia de renovação no mês seguinte ao de `date` */
export function addBillingMonth(date: Date, anchorDay: number): Date {
  const { year, month } = brasiliaParts(date);
  return brasiliaMidnight(year, month + 1, anchorDay);
}

/** Data (Brasília) no formato YYYY-MM-DD, como o Asaas espera */
export function toAsaasDate(date: Date): string {
  const { year, month, day } = brasiliaParts(date);
  return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/** "YYYY-MM-DD" do Asaas -> 00:00 de Brasília */
export function fromAsaasDate(value: string): Date {
  return new Date(`${value.slice(0, 10)}T00:00:00-03:00`);
}

/** Limite de acesso ao plano pago: fim do período pago + tolerância */
export function getAccessDeadline(expiresAt: Date, graceDays = GRACE_DAYS): Date {
  return new Date(expiresAt.getTime() + graceDays * DAY_MS);
}

export interface InitialCharge {
  /** Dia do mês da renovação (1-28), se o plano for ativado agora */
  billingAnchorDay: number;
  recurringAmount: number;
  /** Valor cheio do plano: sem proporcional */
  initialAmount: number;
  /** Primeira renovação, se o plano for ativado agora (a data real parte da ativação) */
  firstRenewalDate: Date;
}

export function computeInitialCharge(now: Date, monthlyPrice: number): InitialCharge {
  const billingAnchorDay = computeAnchorDay(now);
  return {
    billingAnchorDay,
    recurringAmount: monthlyPrice,
    initialAmount: monthlyPrice,
    firstRenewalDate: addBillingMonth(now, billingAnchorDay),
  };
}
