-- Optional invoice identity fields for contacts (auto-filled onto factors when present)
ALTER TABLE "Contact" ADD COLUMN "economicCode" TEXT;
ALTER TABLE "Contact" ADD COLUMN "nationalId" TEXT;
ALTER TABLE "Contact" ADD COLUMN "registrationNumber" TEXT;
ALTER TABLE "Contact" ADD COLUMN "postalCode" TEXT;
