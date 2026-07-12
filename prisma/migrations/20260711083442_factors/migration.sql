-- CreateEnum
CREATE TYPE "PaymentKind" AS ENUM ('CASH', 'CHEQUE', 'HALF_HALF');

-- CreateEnum
CREATE TYPE "FactorState" AS ENUM ('INITIAL', 'FOLLOWING_UP', 'PAID', 'SENDING', 'EXIT');

-- CreateEnum
CREATE TYPE "SourceKind" AS ENUM ('IMANZADEH', 'BAFTINEH', 'BAFT_IRAN', 'BEH_BAFT', 'ANAHITA');

-- CreateTable
CREATE TABLE "Factor" (
    "id" TEXT NOT NULL,
    "number" INTEGER NOT NULL,
    "monthKey" TEXT NOT NULL,
    "state" "FactorState" NOT NULL DEFAULT 'INITIAL',
    "paymentKind" "PaymentKind" NOT NULL DEFAULT 'CASH',
    "contactId" TEXT,
    "buyerName" TEXT NOT NULL,
    "buyerPhone" TEXT,
    "buyerAddress" TEXT,
    "sellerName" TEXT NOT NULL DEFAULT 'اسپان هلدینگ',
    "sellerAddress" TEXT NOT NULL DEFAULT 'تهران، ۵ خرداد',
    "sellerPhone" TEXT NOT NULL DEFAULT '۰۹۱۲۲۶۰۰۸۰۴',
    "sellerMobile" TEXT NOT NULL DEFAULT '۰۹۱۲۴۴۸۴۷۴۴',
    "sellerInstagram" TEXT NOT NULL DEFAULT '@spunholding',
    "sellerWebsite" TEXT NOT NULL DEFAULT 'www.spunholding.com',
    "discount" DECIMAL(16,0) NOT NULL DEFAULT 0,
    "vat" DECIMAL(16,0) NOT NULL DEFAULT 0,
    "notes" TEXT DEFAULT 'اعتبار پیش فاکتور درصورت واریز نقدی حداکثر ۴۸ ساعت می‌باشد',
    "creatorId" TEXT NOT NULL,
    "confirmedById" TEXT,
    "confirmedAt" TIMESTAMP(3),
    "paidAt" TIMESTAMP(3),
    "sentAt" TIMESTAMP(3),
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Factor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FactorItem" (
    "id" TEXT NOT NULL,
    "factorId" TEXT NOT NULL,
    "row" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "quantity" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "unitPrice" DECIMAL(16,0) NOT NULL DEFAULT 0,
    "description" TEXT,

    CONSTRAINT "FactorItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FactorSourceEntry" (
    "id" TEXT NOT NULL,
    "factorId" TEXT NOT NULL,
    "source" "SourceKind" NOT NULL,
    "checked" BOOLEAN NOT NULL DEFAULT false,
    "checkedAt" TIMESTAMP(3),
    "checkedById" TEXT,

    CONSTRAINT "FactorSourceEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FactorSourceOption" (
    "key" "SourceKind" NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "FactorSourceOption_pkey" PRIMARY KEY ("key")
);

-- CreateIndex
CREATE INDEX "Factor_state_idx" ON "Factor"("state");

-- CreateIndex
CREATE INDEX "Factor_creatorId_idx" ON "Factor"("creatorId");

-- CreateIndex
CREATE INDEX "Factor_contactId_idx" ON "Factor"("contactId");

-- CreateIndex
CREATE INDEX "Factor_monthKey_idx" ON "Factor"("monthKey");

-- CreateIndex
CREATE UNIQUE INDEX "Factor_monthKey_number_key" ON "Factor"("monthKey", "number");

-- CreateIndex
CREATE INDEX "FactorItem_factorId_idx" ON "FactorItem"("factorId");

-- CreateIndex
CREATE INDEX "FactorSourceEntry_factorId_idx" ON "FactorSourceEntry"("factorId");

-- CreateIndex
CREATE INDEX "FactorSourceEntry_checked_idx" ON "FactorSourceEntry"("checked");

-- CreateIndex
CREATE UNIQUE INDEX "FactorSourceEntry_factorId_source_key" ON "FactorSourceEntry"("factorId", "source");

-- AddForeignKey
ALTER TABLE "Factor" ADD CONSTRAINT "Factor_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Factor" ADD CONSTRAINT "Factor_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Factor" ADD CONSTRAINT "Factor_confirmedById_fkey" FOREIGN KEY ("confirmedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FactorItem" ADD CONSTRAINT "FactorItem_factorId_fkey" FOREIGN KEY ("factorId") REFERENCES "Factor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FactorSourceEntry" ADD CONSTRAINT "FactorSourceEntry_factorId_fkey" FOREIGN KEY ("factorId") REFERENCES "Factor"("id") ON DELETE CASCADE ON UPDATE CASCADE;
