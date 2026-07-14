import { prisma } from "@/lib/prisma";
import { PaymentKind, FactorState, SourceKind } from "@prisma/client";

/** Payment kinds (نوع پرداخت). */
export const PAYMENT_KIND_LABEL: Record<PaymentKind, string> = {
  CASH: "نقدی",
  CHEQUE: "چکی",
  HALF_HALF: "نصف نقدی نصف چکی",
};

/** Sending sources (منبع) — the fixed allowed set. */
export const SOURCE_LABEL: Record<SourceKind, string> = {
  IMANZADEH: "ایمان‌زاده",
  BAFTINEH: "بافتینه",
  BAFT_IRAN: "بافت ایران",
  BEH_BAFT: "به‌بافت",
  ANAHITA: "آناهیتا",
};

/** All source keys in display order. */
export const SOURCE_KEYS: SourceKind[] = [
  "IMANZADEH",
  "BAFTINEH",
  "BAFT_IRAN",
  "BEH_BAFT",
  "ANAHITA",
];

/** Factor lifecycle states (وضعیت فاکتور). */
export const STATE_LABEL: Record<FactorState, string> = {
  INITIAL: "تأیید اولیه",
  FOLLOWING_UP: "پیگیری",
  PAID: "پرداخت‌شده",
  SENDING: "ارسالی",
  EXIT: "خروج",
  CANCELED: "لغو‌شده",
};

/** States that still count as a pre-factor (پیش‌فاکتور) vs a final factor. */
export function isPreFactor(state: FactorState): boolean {
  return state === "INITIAL" || state === "FOLLOWING_UP";
}

/** States visible only to owner + admin (paid onward). */
export const OWNER_ONLY_STATES: FactorState[] = ["PAID", "SENDING", "EXIT"];

/**
 * Current Jalali (Shamsi) year-month bucket, e.g. "1405-04". Used both for the
 * monthly factor-number sequence and the monthly reset grouping. Latin digits.
 */
export function jalaliMonthKey(d: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-US-u-ca-persian", {
    timeZone: "Asia/Tehran",
    year: "numeric",
    month: "2-digit",
  }).formatToParts(d);
  const y = parts.find((p) => p.type === "year")?.value ?? "0";
  const m = parts.find((p) => p.type === "month")?.value ?? "00";
  return `${y}-${m}`;
}

const COUNTER_ID = "singleton";

/** Ensure the singleton counter row exists, seeded just above the current max. */
async function ensureFactorCounter(): Promise<void> {
  const existing = await prisma.factorCounter.findUnique({ where: { id: COUNTER_ID } });
  if (existing) return;
  const max = await prisma.factor.aggregate({ _max: { number: true } });
  await prisma.factorCounter.upsert({
    where: { id: COUNTER_ID },
    create: { id: COUNTER_ID, next: (max._max.number ?? 0) + 1 },
    update: {},
  });
}

/**
 * Atomically claim the next factor number from the owner-settable running
 * counter. The increment persists even if the subsequent factor create fails,
 * so a retry gets a fresh number (no infinite collision loop). Continuous —
 * numbers do NOT reset per month.
 */
export async function claimFactorNumber(): Promise<number> {
  await ensureFactorCounter();
  const row = await prisma.factorCounter.update({
    where: { id: COUNTER_ID },
    data: { next: { increment: 1 } },
  });
  return row.next - 1;
}

/** Sentinel to roll back the clone transaction when a concurrent render won. */
class AlreadyLinkedError extends Error {}

/**
 * Ensure each source entry of a sent factor has its own cloned child factor
 * (own number, copied buyer/seller + line items). Idempotent — only creates
 * children for entries that don't have one yet. Safe to call on every render of
 * the ارسالی detail page (backfills existing factors too).
 */
export async function ensureSourceChildren(parentId: string): Promise<void> {
  const parent = await prisma.factor.findUnique({
    where: { id: parentId },
    include: {
      items: { orderBy: { row: "asc" } },
      sources: { where: { childFactorId: null }, orderBy: { source: "asc" } },
    },
  });
  // Only top-level (non-child) sent factors spawn children.
  if (!parent || parent.parentFactorId || parent.sources.length === 0) return;

  for (const entry of parent.sources) {
    const itemsData = parent.items.map((it) => ({
      row: it.row,
      name: it.name,
      metrage: it.metrage,
      quantity: it.quantity,
      unitPrice: it.unitPrice,
      description: it.description,
    }));
    for (let attempt = 0; attempt < 5; attempt++) {
      const number = await claimFactorNumber();
      try {
        // Create the child AND link the entry atomically: if the entry was
        // already linked by a concurrent render, the guard trips and the whole
        // transaction rolls back — the just-created child is never committed, so
        // there are no orphan children or stray committed rows.
        await prisma.$transaction(async (tx) => {
          const child = await tx.factor.create({
            data: {
              number,
              monthKey: parent.monthKey,
              state: parent.state,
              paymentKind: parent.paymentKind,
              parentFactorId: parent.id,
              sourceKind: entry.source,
              contactId: parent.contactId,
              buyerName: parent.buyerName,
              buyerPhone: parent.buyerPhone,
              buyerAddress: parent.buyerAddress,
              buyerEconomicCode: parent.buyerEconomicCode,
              buyerNationalId: parent.buyerNationalId,
              buyerRegistrationNumber: parent.buyerRegistrationNumber,
              buyerPostalCode: parent.buyerPostalCode,
              sellerName: parent.sellerName,
              sellerAddress: parent.sellerAddress,
              sellerPhone: parent.sellerPhone,
              sellerMobile: parent.sellerMobile,
              sellerInstagram: parent.sellerInstagram,
              sellerWebsite: parent.sellerWebsite,
              discount: parent.discount,
              vat: parent.vat,
              notes: parent.notes,
              creatorId: parent.creatorId,
              confirmedById: parent.confirmedById,
              items: { create: itemsData },
            },
          });
          const linked = await tx.factorSourceEntry.updateMany({
            where: { id: entry.id, childFactorId: null },
            data: { childFactorId: child.id },
          });
          if (linked.count === 0) throw new AlreadyLinkedError();
        });
        break;
      } catch (err) {
        if (err instanceof AlreadyLinkedError) break; // another render linked it
        const code = (err as { code?: string }).code;
        if (code === "P2002" && attempt < 4) continue; // number taken — retry
        throw err;
      }
    }
  }
}

/** The number the next factor will receive (for display / the owner setter). */
export async function getNextFactorNumber(): Promise<number> {
  const row = await prisma.factorCounter.findUnique({ where: { id: COUNTER_ID } });
  if (row) return row.next;
  const max = await prisma.factor.aggregate({ _max: { number: true } });
  return (max._max.number ?? 0) + 1;
}

/**
 * Ensure the five source-option rows exist. On first ever call (none enabled),
 * enable the first source so the owner starts with one, per requirement.
 */
export async function ensureSourceOptions() {
  const existing = await prisma.factorSourceOption.findMany();
  const missing = SOURCE_KEYS.filter((k) => !existing.some((e) => e.key === k));
  if (missing.length) {
    await prisma.factorSourceOption.createMany({
      data: missing.map((key) => ({ key, enabled: false })),
      skipDuplicates: true,
    });
  }
  const all = await prisma.factorSourceOption.findMany();
  if (!all.some((o) => o.enabled)) {
    await prisma.factorSourceOption.update({
      where: { key: "IMANZADEH" },
      data: { enabled: true },
    });
  }
}

/** The sources the owner has enabled (for the sending menu). */
export async function enabledSources(): Promise<SourceKind[]> {
  await ensureSourceOptions();
  const rows = await prisma.factorSourceOption.findMany({ where: { enabled: true } });
  return SOURCE_KEYS.filter((k) => rows.some((r) => r.key === k));
}
