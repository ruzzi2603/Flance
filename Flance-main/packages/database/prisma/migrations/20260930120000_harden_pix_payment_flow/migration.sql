ALTER TABLE "User" ADD COLUMN "cpfEncrypted" TEXT;

ALTER TABLE "Payment"
  ADD COLUMN "requestKey" TEXT,
  ADD COLUMN "pixExpiresAt" TIMESTAMP(3);

CREATE UNIQUE INDEX "Payment_requestKey_key" ON "Payment"("requestKey");

ALTER TABLE "PaymentActivationCode"
  ADD COLUMN "resendCount" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "lastSentAt" TIMESTAMP(3),
  ADD COLUMN "emailSentAt" TIMESTAMP(3);

CREATE TYPE "WebhookEventStatus" AS ENUM ('RECEIVED', 'PROCESSING', 'PROCESSED', 'FAILED');

CREATE TABLE "PaymentWebhookEvent" (
  "id" TEXT NOT NULL,
  "eventId" TEXT NOT NULL,
  "eventType" TEXT NOT NULL,
  "providerPaymentId" TEXT,
  "status" "WebhookEventStatus" NOT NULL DEFAULT 'RECEIVED',
  "payload" JSONB,
  "errorMessage" TEXT,
  "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "processedAt" TIMESTAMP(3),
  CONSTRAINT "PaymentWebhookEvent_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PaymentWebhookEvent_eventId_key" ON "PaymentWebhookEvent"("eventId");
CREATE INDEX "PaymentWebhookEvent_eventType_idx" ON "PaymentWebhookEvent"("eventType");
CREATE INDEX "PaymentWebhookEvent_providerPaymentId_idx" ON "PaymentWebhookEvent"("providerPaymentId");
CREATE INDEX "PaymentWebhookEvent_status_idx" ON "PaymentWebhookEvent"("status");
CREATE INDEX "PaymentWebhookEvent_receivedAt_idx" ON "PaymentWebhookEvent"("receivedAt");

ALTER TABLE "PaymentWebhookEvent" ENABLE ROW LEVEL SECURITY;
