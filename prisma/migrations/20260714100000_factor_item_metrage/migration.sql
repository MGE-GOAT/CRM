-- Add per-line متراژ (metrage). Line amount = metrage × quantity × unitPrice.
-- Default 1 so existing items keep computing quantity × unitPrice unchanged.
ALTER TABLE "FactorItem" ADD COLUMN "metrage" DECIMAL(14,2) NOT NULL DEFAULT 1;
