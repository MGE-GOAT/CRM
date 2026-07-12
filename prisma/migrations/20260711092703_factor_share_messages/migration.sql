-- AlterEnum
ALTER TYPE "MessageKind" ADD VALUE 'FACTOR_SHARE';

-- AlterTable
ALTER TABLE "Message" ADD COLUMN     "factorId" TEXT;
