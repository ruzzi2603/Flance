CREATE TYPE "PaymentKind" AS ENUM ('INITIAL', 'RECURRING');

ALTER TABLE "Payment"
  ADD COLUMN "kind" "PaymentKind" NOT NULL DEFAULT 'INITIAL',
  ADD COLUMN "providerSubscriptionId" TEXT,
  ADD COLUMN "coversUntil" TIMESTAMP(3),
  ADD COLUMN "reminderSentAt" TIMESTAMP(3),
  ADD COLUMN "overdueNoticeSentAt" TIMESTAMP(3);

CREATE INDEX "Payment_providerSubscriptionId_idx" ON "Payment"("providerSubscriptionId");
CREATE INDEX "Payment_kind_status_dueDate_idx" ON "Payment"("kind", "status", "dueDate");

ALTER TABLE "Subscription"
  ADD COLUMN "asaasSubscriptionId" TEXT,
  ADD COLUMN "billingDay" INTEGER NOT NULL DEFAULT 11,
  ADD COLUMN "nextDueDate" TIMESTAMP(3),
  ADD COLUMN "recurringAmount" DECIMAL(10,2),
  ADD COLUMN "cancelAtPeriodEnd" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "canceledAt" TIMESTAMP(3),
  ADD COLUMN "billingSyncLockedAt" TIMESTAMP(3);

CREATE UNIQUE INDEX "Subscription_asaasSubscriptionId_key" ON "Subscription"("asaasSubscriptionId");

CREATE TABLE "ContractAcceptance" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "contractKey" TEXT NOT NULL,
  "contractVersion" TEXT NOT NULL,
  "contractHash" TEXT NOT NULL,
  "contractSnapshot" JSONB NOT NULL,
  "plan" "PlanTier" NOT NULL,
  "planPrice" DECIMAL(10,2) NOT NULL,
  "billingDay" INTEGER NOT NULL,
  "initialAmount" DECIMAL(10,2) NOT NULL,
  "paymentId" TEXT,
  "ipAddress" TEXT,
  "userAgent" TEXT,
  "acceptedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ContractAcceptance_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ContractAcceptance_paymentId_key" ON "ContractAcceptance"("paymentId");
CREATE INDEX "ContractAcceptance_userId_idx" ON "ContractAcceptance"("userId");
CREATE INDEX "ContractAcceptance_contractKey_contractVersion_idx" ON "ContractAcceptance"("contractKey", "contractVersion");

ALTER TABLE "ContractAcceptance"
  ADD CONSTRAINT "ContractAcceptance_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ContractAcceptance" ENABLE ROW LEVEL SECURITY;
