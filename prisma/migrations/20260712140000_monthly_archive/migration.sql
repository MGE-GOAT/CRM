-- Persisted end-of-month backup snapshot (stored before the month's live rows are purged)
CREATE TABLE "MonthlyArchive" (
    "id" TEXT NOT NULL,
    "month" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "factorCount" INTEGER NOT NULL DEFAULT 0,
    "attendanceCount" INTEGER NOT NULL DEFAULT 0,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "MonthlyArchive_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "MonthlyArchive_month_key" ON "MonthlyArchive"("month");
