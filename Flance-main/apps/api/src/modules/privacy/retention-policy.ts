/**
 * Prazos de retenção. DEVEM bater com a seção 8 da Política de Privacidade (/privacidade).
 * Alterou aqui? Atualize o texto e a versão da política.
 */
export const FINANCIAL_RETENTION_YEARS = 5; // pagamentos, assinaturas, aceites de contrato
export const AUDIT_LOG_RETENTION_YEARS = 5; // dados pessoais em logs de moderação
export const TOKEN_GRACE_DAYS = 30; // tokens de sessão e códigos vencidos/usados são apagados após isso
export const PASSWORD_RESET_GRACE_DAYS = 7;
export const DELETE_CONFIRMATION_WORD = "EXCLUIR";

export const yearsAgo = (years: number, from = new Date()) => {
  const date = new Date(from);
  date.setFullYear(date.getFullYear() - years);
  return date;
};
export const daysAgo = (days: number, from = new Date()) => new Date(from.getTime() - days * 24 * 60 * 60 * 1000);
