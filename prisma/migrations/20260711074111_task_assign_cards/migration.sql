-- CreateEnum
CREATE TYPE "MessageKind" AS ENUM ('NORMAL', 'TASK_ASSIGN');

-- AlterTable
ALTER TABLE "Message" ADD COLUMN     "ackedAt" TIMESTAMP(3),
ADD COLUMN     "kind" "MessageKind" NOT NULL DEFAULT 'NORMAL',
ADD COLUMN     "taskId" TEXT;
