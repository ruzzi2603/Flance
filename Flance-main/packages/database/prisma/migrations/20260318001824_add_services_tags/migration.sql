-- AlterTable
ALTER TABLE "Conversation" ALTER COLUMN "jobId" DROP NOT NULL,
ALTER COLUMN "proposalId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "servicesTags" TEXT[] DEFAULT ARRAY[]::TEXT[];
