-- Volta a usar a assinatura do Asaas (Pix, MONTHLY), ancorada no dia da ativação (1 a 28).
-- Sem dia fixo (11) e sem valor proporcional.

ALTER TABLE "Subscription" RENAME COLUMN "billingPeriodDays" TO "billingAnchorDay";
ALTER TABLE "Subscription" ALTER COLUMN "billingAnchorDay" SET DEFAULT 1;
ALTER TABLE "Subscription" ADD COLUMN "asaasSubscriptionId" TEXT;
ALTER TABLE "Subscription" ADD COLUMN "billingSyncLockedAt" TIMESTAMP(3);
CREATE UNIQUE INDEX "Subscription_asaasSubscriptionId_key" ON "Subscription"("asaasSubscriptionId");

ALTER TABLE "Payment" ADD COLUMN "providerSubscriptionId" TEXT;
CREATE INDEX "Payment_providerSubscriptionId_idx" ON "Payment"("providerSubscriptionId");

ALTER TABLE "ContractAcceptance" RENAME COLUMN "billingPeriodDays" TO "billingAnchorDay";
