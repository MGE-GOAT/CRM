import { prisma } from "@/lib/prisma";
import {
  monthRange,
  formatMonthLabel,
  currentTehranMonth,
} from "@/lib/attendance-report";
import { PAYMENT_KIND_LABEL, STATE_LABEL } from "@/lib/factor";
import { factorPayable } from "@/lib/factor-total";
import type { PaymentKind, Prisma } from "@prisma/client";

const PAYMENT_KINDS: PaymentKind[] = ["CASH", "CHEQUE", "HALF_HALF"];

// Either the base client or a transaction client — lets the snapshot be built
// INSIDE closeMonth's transaction so read + purge see one consistent state.
type Db = Prisma.TransactionClient;

/** Minutes of presence between two instants (0 if clock-out missing/earlier). */
function presenceMinutes(clockIn: Date, clockOut: Date | null): number {
  if (!clockOut) return 0;
  return Math.max(0, Math.round((clockOut.getTime() - clockIn.getTime()) / 60000));
}

/**
 * Build a complete, self-contained snapshot of one Jalali month: per-user
 * work-hours + paid-factor counts, plus the underlying attendance log and the
 * paid-factor list. Used both for the on-screen report and the downloadable
 * monthly backup so the owner retains each month even after a reset.
 */
export async function buildMonthlyBackup(month: string, db: Db = prisma) {
  const { start, end } = monthRange(month);

  const [users, attendance, paidFactors] = await Promise.all([
    db.user.findMany({
      where: { isActive: true },
      select: { id: true, name: true, role: true },
      orderBy: { name: "asc" },
    }),
    db.attendance.findMany({
      where: { clockIn: { gte: start, lt: end } },
      include: { user: { select: { name: true } } },
      orderBy: [{ clockIn: "asc" }],
    }),
    db.factor.findMany({
      where: {
        parentFactorId: null,
        paidAt: { gte: start, lt: end },
        state: { in: ["PAID", "SENDING", "EXIT"] },
      },
      include: {
        items: { select: { metrage: true, quantity: true, unitPrice: true } },
        creator: { select: { name: true } },
      },
      orderBy: [{ paidAt: "asc" }],
    }),
  ]);

  // Per-user aggregates.
  const perUser = users.map((u) => {
    const rows = attendance.filter((a) => a.userId === u.id);
    const totalMinutes = rows.reduce((s, a) => s + presenceMinutes(a.clockIn, a.clockOut), 0);
    const paid = paidFactors.filter((f) => f.creatorId === u.id);
    const paidByKind = Object.fromEntries(
      PAYMENT_KINDS.map((k) => [k, paid.filter((f) => f.paymentKind === k).length]),
    ) as Record<PaymentKind, number>;
    const paidTotalRial = paid.reduce((s, f) => s + Math.round(factorPayable(f)), 0);
    return {
      userId: u.id,
      name: u.name,
      role: u.role,
      attendanceDays: rows.length,
      workHours: Math.floor(totalMinutes / 60),
      workMinutes: totalMinutes % 60,
      totalWorkMinutes: totalMinutes,
      paidFactorsByKind: paidByKind,
      paidFactorsTotal: paid.length,
      paidTotalRial,
    };
  });

  return {
    month,
    monthLabel: formatMonthLabel(month),
    generatedAt: new Date().toISOString(),
    rangeStart: start.toISOString(),
    rangeEnd: end.toISOString(),
    paymentKindLabels: PAYMENT_KIND_LABEL,
    summary: perUser,
    attendanceLog: attendance.map((a) => ({
      user: a.user.name,
      userId: a.userId,
      clockIn: a.clockIn.toISOString(),
      clockOut: a.clockOut ? a.clockOut.toISOString() : null,
      minutes: presenceMinutes(a.clockIn, a.clockOut),
    })),
    paidFactors: paidFactors.map((f) => ({
      number: f.number,
      buyerName: f.buyerName,
      creator: f.creator.name,
      creatorId: f.creatorId,
      paymentKind: f.paymentKind,
      paymentKindLabel: PAYMENT_KIND_LABEL[f.paymentKind],
      state: f.state,
      stateLabel: STATE_LABEL[f.state],
      payableRial: Math.round(factorPayable(f)),
      paidAt: f.paidAt ? f.paidAt.toISOString() : null,
    })),
  };
}

/**
 * A COMPLETE archive snapshot for a month: the on-screen summary above, PLUS
 * every factor whose monthKey is this month, captured in full detail (buyer +
 * identity fields, line items, all timestamps, sources). This is what gets
 * persisted before the month's live rows are purged, so a closed month can be
 * fully reconstructed/audited later.
 */
export async function buildMonthArchive(month: string, db: Db = prisma) {
  const base = await buildMonthlyBackup(month, db);
  const factors = await db.factor.findMany({
    // Top-level factors only; per-source children are captured via each
    // parent's `sources` relation (with their childFactorId), not as extra rows.
    where: { monthKey: month, parentFactorId: null },
    include: {
      items: { orderBy: { row: "asc" } },
      // Include each source's child factor (number + edited items) so the
      // per-source amounts survive the purge inside this one archive row.
      sources: {
        orderBy: { source: "asc" },
        include: { child: { include: { items: { orderBy: { row: "asc" } } } } },
      },
      creator: { select: { name: true } },
    },
    orderBy: [{ number: "asc" }],
  });

  return {
    ...base,
    allFactors: factors.map((f) => ({
      number: f.number,
      state: f.state,
      stateLabel: STATE_LABEL[f.state],
      paymentKind: f.paymentKind,
      paymentKindLabel: PAYMENT_KIND_LABEL[f.paymentKind],
      creator: f.creator.name,
      creatorId: f.creatorId,
      buyerName: f.buyerName,
      buyerPhone: f.buyerPhone,
      buyerAddress: f.buyerAddress,
      buyerEconomicCode: f.buyerEconomicCode,
      buyerNationalId: f.buyerNationalId,
      buyerRegistrationNumber: f.buyerRegistrationNumber,
      buyerPostalCode: f.buyerPostalCode,
      sellerName: f.sellerName,
      sellerAddress: f.sellerAddress,
      sellerPhone: f.sellerPhone,
      sellerMobile: f.sellerMobile,
      sellerInstagram: f.sellerInstagram,
      sellerWebsite: f.sellerWebsite,
      discount: Number(f.discount),
      vat: Number(f.vat),
      payableRial: Math.round(factorPayable(f)),
      notes: f.notes,
      createdAt: f.createdAt.toISOString(),
      confirmedAt: f.confirmedAt ? f.confirmedAt.toISOString() : null,
      paidAt: f.paidAt ? f.paidAt.toISOString() : null,
      sentAt: f.sentAt ? f.sentAt.toISOString() : null,
      archivedAt: f.archivedAt ? f.archivedAt.toISOString() : null,
      canceledAt: f.canceledAt ? f.canceledAt.toISOString() : null,
      items: f.items.map((it) => ({
        row: it.row,
        name: it.name,
        metrage: Number(it.metrage),
        quantity: Number(it.quantity),
        unitPrice: Number(it.unitPrice),
        description: it.description,
      })),
      sources: f.sources.map((s) => ({
        source: s.source,
        checked: s.checked,
        checkedAt: s.checkedAt ? s.checkedAt.toISOString() : null,
        // The source's own (edited) child factor, preserved in FULL before the
        // purge cascade-deletes it — buyer/seller identity, state, notes and
        // timestamps included, so nothing editable is lost from the archive.
        childFactor: s.child
          ? {
              number: s.child.number,
              state: s.child.state,
              stateLabel: STATE_LABEL[s.child.state],
              paymentKind: s.child.paymentKind,
              paymentKindLabel: PAYMENT_KIND_LABEL[s.child.paymentKind],
              buyerName: s.child.buyerName,
              buyerPhone: s.child.buyerPhone,
              buyerAddress: s.child.buyerAddress,
              buyerEconomicCode: s.child.buyerEconomicCode,
              buyerNationalId: s.child.buyerNationalId,
              buyerRegistrationNumber: s.child.buyerRegistrationNumber,
              buyerPostalCode: s.child.buyerPostalCode,
              sellerName: s.child.sellerName,
              sellerAddress: s.child.sellerAddress,
              sellerPhone: s.child.sellerPhone,
              sellerMobile: s.child.sellerMobile,
              sellerInstagram: s.child.sellerInstagram,
              sellerWebsite: s.child.sellerWebsite,
              discount: Number(s.child.discount),
              vat: Number(s.child.vat),
              payableRial: Math.round(factorPayable(s.child)),
              notes: s.child.notes,
              createdAt: s.child.createdAt.toISOString(),
              sentAt: s.child.sentAt ? s.child.sentAt.toISOString() : null,
              archivedAt: s.child.archivedAt ? s.child.archivedAt.toISOString() : null,
              items: s.child.items.map((it) => ({
                row: it.row,
                name: it.name,
                metrage: Number(it.metrage),
                quantity: Number(it.quantity),
                unitPrice: Number(it.unitPrice),
                description: it.description,
              })),
            }
          : null,
      })),
    })),
  };
}

export type CloseMonthResult = {
  month: string;
  archived: boolean;
  purgedFactors: number;
  purgedAttendance: number;
  reason?: string;
};

/**
 * Close a PAST month: persist a complete archive snapshot (every factor of the
 * month), then purge only the FINISHED factors — EXIT (خروج) and CANCELED
 * (لغو‌شده) — plus that month's attendance. In-flight pre-factors
 * (INITIAL/FOLLOWING_UP/PAID/SENDING) stay in the live lists so nothing active
 * is swept away. Idempotent, never touches the current month. Deleting a factor
 * cascades its items + source entries. Shared by the owner action and the cron.
 */
const PURGEABLE_STATES = ["EXIT", "CANCELED"] as const;
export async function closeMonth(
  month: string,
  actorId?: string,
): Promise<CloseMonthResult> {
  // Guard: never purge the live month.
  if (month >= currentTehranMonth()) {
    return {
      month,
      archived: false,
      purgedFactors: 0,
      purgedAttendance: 0,
      reason: "ماه جاری قابل بستن نیست؛ فقط ماه‌های گذشته.",
    };
  }

  const alreadyClosed: CloseMonthResult = {
    month,
    archived: false,
    purgedFactors: 0,
    purgedAttendance: 0,
    reason: "این ماه قبلاً بسته و آرشیو شده است.",
  };

  // Fast path: already archived → nothing to do.
  if (await prisma.monthlyArchive.findUnique({ where: { month } })) return alreadyClosed;

  const { start, end } = monthRange(month);

  try {
    // Build the snapshot AND purge inside ONE interactive transaction, so the
    // archived JSON and the deleted rows reflect exactly the same DB state
    // (no read-then-delete window). The archive captures ALL factors of the
    // month; only the finished ones (EXIT/CANCELED) plus attendance are purged.
    return await prisma.$transaction(
      async (tx) => {
        const payload = await buildMonthArchive(month, tx);
        await tx.monthlyArchive.create({
          data: {
            month,
            payload: payload as unknown as object,
            factorCount: payload.allFactors.length,
            attendanceCount: payload.attendanceLog.length,
            createdById: actorId ?? null,
          },
        });
        const purgedF = await tx.factor.deleteMany({
          where: { monthKey: month, state: { in: [...PURGEABLE_STATES] } },
        });
        const purgedA = await tx.attendance.deleteMany({
          where: { clockIn: { gte: start, lt: end } },
        });
        return {
          month,
          archived: true,
          purgedFactors: purgedF.count,
          purgedAttendance: purgedA.count,
        };
      },
      { timeout: 120_000 },
    );
  } catch (e) {
    // A concurrent close won the race and created the archive first (unique
    // constraint on `month`) — treat as already-closed rather than an error.
    if (
      e &&
      typeof e === "object" &&
      "code" in e &&
      (e as { code?: string }).code === "P2002"
    ) {
      return alreadyClosed;
    }
    throw e;
  }
}

/**
 * Reclaim storage from factors that were still in-flight (SENDING) when their
 * month was archived and only later reached EXIT/CANCELED: closeMonth is
 * idempotent-blocked once the archive exists, so these would otherwise stay live
 * forever. They were already captured in the archive snapshot at close time, so
 * purging the now-finished rows here is safe (children cascade). Returns count.
 */
export async function sweepFinishedInClosedMonths(db: Db = prisma): Promise<number> {
  const archived = await db.monthlyArchive.findMany({ select: { month: true } });
  if (archived.length === 0) return 0;
  const res = await db.factor.deleteMany({
    where: {
      monthKey: { in: archived.map((a) => a.month) },
      state: { in: ["EXIT", "CANCELED"] },
    },
  });
  return res.count;
}
