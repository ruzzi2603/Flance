-- Cobrança passa a ser a cada 30 dias contados da ativação (sem dia fixo e sem proporcional).
-- O Flance gera o Pix de cada renovação; a assinatura do Asaas deixa de ser usada.

ALTER TABLE "Subscription" RENAME COLUMN "billingDay" TO "billingPeriodDays";
ALTER TABLE "Subscription" ALTER COLUMN "billingPeriodDays" SET DEFAULT 30;
UPDATE "Subscription" SET "billingPeriodDays" = 30;
ALTER TABLE "Subscription" DROP COLUMN "asaasSubscriptionId";
ALTER TABLE "Subscription" DROP COLUMN "billingSyncLockedAt";

DROP INDEX IF EXISTS "Payment_providerSubscriptionId_idx";
ALTER TABLE "Payment" DROP COLUMN "providerSubscriptionId";

-- Aceites antigos (se houver) mantêm o texto aceito no snapshot; a coluna passa a significar "dias do período".
ALTER TABLE "ContractAcceptance" RENAME COLUMN "billingDay" TO "billingPeriodDays";
