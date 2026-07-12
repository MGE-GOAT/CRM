-- Owner-settable continuous factor-number counter (singleton row).
CREATE TABLE "FactorCounter" (
    "id" TEXT NOT NULL,
    "next" INTEGER NOT NULL DEFAULT 1,
    CONSTRAINT "FactorCounter_pkey" PRIMARY KEY ("id")
);
-- Seed the counter just above the current highest factor number so existing
-- numbering continues seamlessly (owner can override to their real sequence).
INSERT INTO "FactorCounter" ("id", "next")
VALUES ('singleton', COALESCE((SELECT MAX("number") FROM "Factor"), 0) + 1);
