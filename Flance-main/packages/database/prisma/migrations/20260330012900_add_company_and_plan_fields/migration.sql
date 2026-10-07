-- CreateEnum
CREATE TYPE "PlanTier" AS ENUM ('FREE', 'BASIC', 'PRO', 'PREMIUM');

-- AlterTable
ALTER TABLE "User" ADD COLUMN "companyEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "companyName" TEXT,
ADD COLUMN "companyCnpj" TEXT,
ADD COLUMN "companyDescription" TEXT,
ADD COLUMN "companyLocation" TEXT,
ADD COLUMN "companyCity" TEXT,
ADD COLUMN "companyState" TEXT,
ADD COLUMN "companyAddress" TEXT,
ADD COLUMN "companyWebsite" TEXT,
ADD COLUMN "companyInstagram" TEXT,
ADD COLUMN "companyWhatsapp" TEXT,
ADD COLUMN "companyEmail" TEXT,
ADD COLUMN "companyHours" TEXT,
ADD COLUMN "companyPhotos" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN "companyIsOnline" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN "companyIsPhysical" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "companyViews" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "planTier" "PlanTier" NOT NULL DEFAULT 'FREE',
ADD COLUMN "planStartedAt" TIMESTAMP(3),
ADD COLUMN "planRenewsAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "User_companyEnabled_idx" ON "User"("companyEnabled");
