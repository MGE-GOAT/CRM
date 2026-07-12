-- Optional buyer invoice-identity fields snapshotted onto each factor
ALTER TABLE "Factor" ADD COLUMN "buyerEconomicCode" TEXT;
ALTER TABLE "Factor" ADD COLUMN "buyerNationalId" TEXT;
ALTER TABLE "Factor" ADD COLUMN "buyerRegistrationNumber" TEXT;
ALTER TABLE "Factor" ADD COLUMN "buyerPostalCode" TEXT;
