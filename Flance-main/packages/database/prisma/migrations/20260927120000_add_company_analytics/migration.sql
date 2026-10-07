CREATE TYPE "CompanyAnalyticsEventType" AS ENUM ('VIEW', 'SHARE');

CREATE TABLE "CompanyAnalyticsEvent" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "eventType" "CompanyAnalyticsEventType" NOT NULL,
    "sessionId" TEXT NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'profile',
    "durationSeconds" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CompanyAnalyticsEvent_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "CompanyAnalyticsEvent_durationSeconds_check" CHECK ("durationSeconds" >= 0 AND "durationSeconds" <= 86400)
);

CREATE INDEX "CompanyAnalyticsEvent_companyId_eventType_createdAt_idx" ON "CompanyAnalyticsEvent"("companyId", "eventType", "createdAt");
CREATE INDEX "CompanyAnalyticsEvent_companyId_createdAt_idx" ON "CompanyAnalyticsEvent"("companyId", "createdAt");
CREATE UNIQUE INDEX "CompanyAnalyticsEvent_companyId_sessionId_eventType_source_key" ON "CompanyAnalyticsEvent"("companyId", "sessionId", "eventType", "source");

ALTER TABLE "CompanyAnalyticsEvent" ADD CONSTRAINT "CompanyAnalyticsEvent_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CompanyAnalyticsEvent" ENABLE ROW LEVEL SECURITY;