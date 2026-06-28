-- AlterTable
ALTER TABLE "Reminder" ADD COLUMN     "smsError" TEXT,
ADD COLUMN     "smsSentAt" TIMESTAMP(3),
ADD COLUMN     "smsStatus" TEXT;
