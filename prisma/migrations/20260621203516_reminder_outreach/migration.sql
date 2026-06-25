-- CreateEnum
CREATE TYPE "ReminderAction" AS ENUM ('GENERAL', 'CALL', 'WHATSAPP', 'SMS');

-- AlterTable
ALTER TABLE "Reminder" ADD COLUMN     "action" "ReminderAction" NOT NULL DEFAULT 'GENERAL',
ADD COLUMN     "contactId" TEXT,
ADD COLUMN     "done" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "messageBody" TEXT;

-- AddForeignKey
ALTER TABLE "Reminder" ADD CONSTRAINT "Reminder_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE SET NULL ON UPDATE CASCADE;
