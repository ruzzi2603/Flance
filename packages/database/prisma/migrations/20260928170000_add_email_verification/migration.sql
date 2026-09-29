ALTER TABLE "User" ADD COLUMN "emailVerifiedAt" TIMESTAMP(3);

CREATE TABLE "EmailVerificationCode" (
  "id" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "passwordHash" TEXT NOT NULL,
  "avatarUrl" TEXT,
  "codeHash" TEXT NOT NULL,
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "lastSentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "EmailVerificationCode_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "EmailVerificationCode_email_key" ON "EmailVerificationCode"("email");
CREATE INDEX "EmailVerificationCode_expiresAt_idx" ON "EmailVerificationCode"("expiresAt");
ALTER TABLE "EmailVerificationCode" ENABLE ROW LEVEL SECURITY;