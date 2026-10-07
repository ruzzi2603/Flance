-- CreateEnum
CREATE TYPE "BudgetType" AS ENUM ('FIXED', 'RANGE', 'NEGOTIABLE');

-- AlterTable
ALTER TABLE "Job" ADD COLUMN     "budgetMax" DECIMAL(10,2),
ADD COLUMN     "budgetMin" DECIMAL(10,2),
ADD COLUMN     "budgetType" "BudgetType" NOT NULL DEFAULT 'FIXED',
ALTER COLUMN "budget" DROP NOT NULL;
