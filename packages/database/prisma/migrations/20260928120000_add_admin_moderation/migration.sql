ALTER TYPE "Role" ADD VALUE 'ADMIN';

ALTER TABLE "User"
  ADD COLUMN "bannedAt" TIMESTAMP(3),
  ADD COLUMN "banReason" TEXT;

CREATE TYPE "AdminActionType" AS ENUM (
  'USER_ALERTED',
  'AD_REMOVED',
  'AD_RESTORED',
  'USER_BANNED',
  'USER_UNBANNED',
  'USER_DELETED'
);

CREATE TYPE "AdminNotificationStatus" AS ENUM ('PENDING', 'SENT', 'FAILED');

CREATE TABLE "AdminAuditLog" (
  "id" TEXT NOT NULL,
  "adminId" TEXT NOT NULL,
  "targetUserId" TEXT,
  "targetEmail" TEXT NOT NULL,
  "targetName" TEXT NOT NULL,
  "action" "AdminActionType" NOT NULL,
  "reason" TEXT NOT NULL,
  "notificationStatus" "AdminNotificationStatus" NOT NULL DEFAULT 'PENDING',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AdminAuditLog_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "AdminAuditLog_createdAt_idx" ON "AdminAuditLog"("createdAt");
CREATE INDEX "AdminAuditLog_targetUserId_createdAt_idx" ON "AdminAuditLog"("targetUserId", "createdAt");
CREATE INDEX "AdminAuditLog_adminId_createdAt_idx" ON "AdminAuditLog"("adminId", "createdAt");

ALTER TABLE "AdminAuditLog" ENABLE ROW LEVEL SECURITY;