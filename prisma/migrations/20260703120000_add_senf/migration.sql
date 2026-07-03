-- Add صنف (business/trade category) to contacts and companies for filtering
ALTER TABLE "Contact" ADD COLUMN "senf" TEXT;
ALTER TABLE "Company" ADD COLUMN "senf" TEXT;
