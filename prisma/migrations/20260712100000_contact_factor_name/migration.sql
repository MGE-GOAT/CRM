-- Add optional factor name (customer-facing official name shown on invoices)
ALTER TABLE "Contact" ADD COLUMN "factorName" TEXT;
