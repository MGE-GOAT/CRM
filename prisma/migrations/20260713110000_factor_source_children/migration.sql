-- Per-source child factors: a sent factor clones one editable/printable child
-- factor per منبع ارسال. Children carry their own number and are excluded from
-- top-level lists via parentFactorId.

ALTER TABLE "Factor" ADD COLUMN "parentFactorId" TEXT;
ALTER TABLE "Factor" ADD COLUMN "sourceKind" "SourceKind";

ALTER TABLE "FactorSourceEntry" ADD COLUMN "childFactorId" TEXT;

CREATE INDEX "Factor_parentFactorId_idx" ON "Factor" ("parentFactorId");
CREATE UNIQUE INDEX "FactorSourceEntry_childFactorId_key" ON "FactorSourceEntry" ("childFactorId");

-- Deleting a parent cascades to its children; deleting a child just detaches it
-- from its source entry.
ALTER TABLE "Factor"
  ADD CONSTRAINT "Factor_parentFactorId_fkey"
  FOREIGN KEY ("parentFactorId") REFERENCES "Factor" ("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "FactorSourceEntry"
  ADD CONSTRAINT "FactorSourceEntry_childFactorId_fkey"
  FOREIGN KEY ("childFactorId") REFERENCES "Factor" ("id") ON DELETE SET NULL ON UPDATE CASCADE;
