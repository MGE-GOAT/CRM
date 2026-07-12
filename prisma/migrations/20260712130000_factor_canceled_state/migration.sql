-- Add CANCELED factor state (buyer didn't pay after initial confirmation) + timestamp
ALTER TYPE "FactorState" ADD VALUE IF NOT EXISTS 'CANCELED';
ALTER TABLE "Factor" ADD COLUMN "canceledAt" TIMESTAMP(3);
