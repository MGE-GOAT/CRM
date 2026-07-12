import Link from "next/link";
import { Download, FileArchive } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { Avatar } from "@/components/ui/avatar";
import { formatDate, formatTime, formatNumber, toFa } from "@/lib/format";
import { PAYMENT_KIND_LABEL } from "@/lib/factor";
import type { PaymentKind } from "@prisma/client";
import {
  monthRange,
  recentMonths,
  formatMonthLabel,
} from "@/lib/attendance-report";

const PAYMENT_KINDS: PaymentKind[] = ["CASH", "CHEQUE", "HALF_HALF"];

/** Human-friendly presence duration between two instants (Persian numerals). */
function formatDuration(clockIn: Date, clockOut: Date): string {
  const mins = Math.max(0, Math.round((clockOut.getTime() - clockIn.getTime()) / 60000));
  const hours = Math.floor(mins / 60);
  const rem = mins % 60;
  if (hours && rem) return `${toFa(hours)} ساعت و ${toFa(rem)} دقیقه`;
  if (hours) return `${toFa(hours)} ساعت`;
  return `${toFa(rem)} دقیقه`;
}

type Props = {
  month: string;
  userId?: string;
};

/**
 * OWNER-only attendance + activity report: per-day clock-in/out rows for the
 * selected Tehran month, each annotated with that member's count of paid
 * factors per payment type (linking to a drill-down). Read-only.
 */
export async function AttendanceSection({ month, userId }: Props) {
  const { start, end } = monthRange(month);

  const [users, attendance, paidFactors] = await Promise.all([
    prisma.user.findMany({
      where: { isActive: true },
      select: { id: true, name: true, avatarColor: true },
      orderBy: { name: "asc" },
    }),
    prisma.attendance.findMany({
      // Filter by the Jalali month's Gregorian instant range (day is stored as
      // a Gregorian bucket, so a string prefix wouldn't map to a Jalali month).
      where: {
        clockIn: { gte: start, lt: end },
        ...(userId ? { userId } : {}),
      },
      include: { user: { select: { name: true, avatarColor: true } } },
      orderBy: [{ clockIn: "desc" }],
    }),
    prisma.factor.findMany({
      where: {
        parentFactorId: null,
        paidAt: { gte: start, lt: end },
        state: { in: ["PAID", "SENDING", "EXIT"] },
      },
      select: { creatorId: true, paymentKind: true },
    }),
  ]);

  // Per-user paid-factor counts, keyed by "userId|kind".
  const counts = new Map<string, number>();
  for (const f of paidFactors) {
    const key = `${f.creatorId}|${f.paymentKind}`;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  // Per-user monthly totals (work-minutes + total paid factors) for the recap.
  const totals = new Map<string, { minutes: number; paid: number; days: number }>();
  for (const a of attendance) {
    const t = totals.get(a.userId) ?? { minutes: 0, paid: 0, days: 0 };
    if (a.clockOut) t.minutes += Math.max(0, Math.round((a.clockOut.getTime() - a.clockIn.getTime()) / 60000));
    t.days += 1;
    totals.set(a.userId, t);
  }
  for (const f of paidFactors) {
    const t = totals.get(f.creatorId) ?? { minutes: 0, paid: 0, days: 0 };
    t.paid += 1;
    totals.set(f.creatorId, t);
  }
  const summaryUsers = users.filter((u) => totals.has(u.id));

  const monthOptions = recentMonths(12);

  return (
    <>
      {/* Section divider */}
      <div className="flex items-center gap-3 pt-2">
        <h2 className="text-sm font-bold tracking-tight text-text">
          حضور و غیاب و فعالیت کاربران
        </h2>
        <span className="rounded-full bg-[var(--gold-tint)] px-2 py-0.5 text-xs font-medium text-[color:var(--gold-ink)]">
          فقط مالک
        </span>
        <div className="h-px flex-1 bg-border" />
        <a
          href={`/api/reports/backup?month=${month}`}
          className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface px-3 py-1.5 text-xs font-medium text-muted transition-colors hover:bg-surface-2 hover:text-text"
          title={`بکاپ داده‌ای ${formatMonthLabel(month)} (JSON)`}
        >
          <Download size={14} aria-hidden="true" /> بکاپ داده‌ای
        </a>
        <a
          href={`/api/reports/backup/pdf?month=${month}`}
          className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface px-3 py-1.5 text-xs font-medium text-muted transition-colors hover:bg-surface-2 hover:text-text"
          title={`بکاپ PDF فاکتورهای ${formatMonthLabel(month)} (ZIP)`}
        >
          <FileArchive size={14} aria-hidden="true" /> بکاپ PDF فاکتورها
        </a>
      </div>

      {/* Filters — native GET form on "/" so state lives in the URL */}
      <form method="GET" className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-muted">ماه</span>
          <select
            name="month"
            defaultValue={month}
            className="rounded-lg border border-border bg-surface px-3 py-2 text-sm"
          >
            {monthOptions.map((m) => (
              <option key={m} value={m}>
                {formatMonthLabel(m)}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-muted">کاربر</span>
          <select
            name="user"
            defaultValue={userId ?? ""}
            className="rounded-lg border border-border bg-surface px-3 py-2 text-sm"
          >
            <option value="">همه کاربران</option>
            {users.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name}
              </option>
            ))}
          </select>
        </label>
        <button
          type="submit"
          className="rounded-lg bg-[color:var(--gold-ink)] px-4 py-2 text-sm font-medium text-white"
        >
          اعمال فیلتر
        </button>
      </form>

      {/* Per-user monthly recap (work-hours + total paid factors) */}
      {summaryUsers.length > 0 && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {summaryUsers.map((u) => {
            const t = totals.get(u.id)!;
            const hrs = Math.floor(t.minutes / 60);
            const mins = t.minutes % 60;
            return (
              <div
                key={u.id}
                className="rounded-2xl border border-border bg-surface p-4 shadow-[var(--shadow-sm)]"
              >
                <div className="mb-3 flex items-center gap-2">
                  <Avatar name={u.name} color={u.avatarColor} size={30} />
                  <span className="font-bold tracking-tight">{u.name}</span>
                </div>
                <dl className="grid grid-cols-3 gap-2 text-center">
                  <div>
                    <dt className="text-xs text-muted">ساعت کاری</dt>
                    <dd className="text-lg font-bold tabular-nums">
                      {toFa(hrs)}
                      {mins > 0 && <span className="text-sm text-muted">:{toFa(String(mins).padStart(2, "0"))}</span>}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted">روز حضور</dt>
                    <dd className="text-lg font-bold tabular-nums">{toFa(t.days)}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted">فاکتور پرداخت‌شده</dt>
                    <dd className="text-lg font-bold tabular-nums text-[color:var(--gold-ink)]">
                      {toFa(t.paid)}
                    </dd>
                  </div>
                </dl>
              </div>
            );
          })}
        </div>
      )}

      {/* Attendance table */}
      <section className="overflow-x-auto rounded-2xl border border-border bg-surface shadow-[var(--shadow-md)]">
        <table className="w-full min-w-[720px] text-sm">
          <thead className="border-b-2 border-[color:var(--rule)] bg-surface-2 text-right text-xs tracking-wide text-muted">
            <tr>
              <th className="px-5 py-3 font-medium">کاربر</th>
              <th className="px-4 py-3 font-medium">تاریخ</th>
              <th className="px-4 py-3 font-medium">ورود</th>
              <th className="px-4 py-3 font-medium">خروج</th>
              <th className="px-4 py-3 font-medium">مدت حضور</th>
              <th className="px-4 py-3 font-medium">فاکتورهای پرداخت‌شده</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {attendance.length === 0 && (
              <tr>
                <td colSpan={6} className="px-5 py-6 text-muted">
                  برای این ماه رکورد حضوری ثبت نشده است.
                </td>
              </tr>
            )}
            {attendance.map((row) => (
              <tr key={row.id} className="hover:bg-[var(--gold-tint)]">
                <td className="px-5 py-3">
                  <div className="flex items-center gap-2.5">
                    <Avatar name={row.user.name} color={row.user.avatarColor} size={30} />
                    <span className="font-medium">{row.user.name}</span>
                  </div>
                </td>
                <td className="px-4 py-3 tabular-nums">{formatDate(row.clockIn)}</td>
                <td className="px-4 py-3 tabular-nums">{formatTime(row.clockIn)}</td>
                <td className="px-4 py-3 tabular-nums text-muted">
                  {row.clockOut ? formatTime(row.clockOut) : "—"}
                </td>
                <td className="px-4 py-3 tabular-nums text-muted">
                  {row.clockOut ? (
                    formatDuration(row.clockIn, row.clockOut)
                  ) : (
                    <span className="text-[color:var(--gold-ink)]">حاضر</span>
                  )}
                </td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap gap-1.5">
                    {PAYMENT_KINDS.map((kind) => {
                      const n = counts.get(`${row.userId}|${kind}`) ?? 0;
                      const label = `${PAYMENT_KIND_LABEL[kind]} ${formatNumber(n)}`;
                      if (n === 0) {
                        return (
                          <span
                            key={kind}
                            className="rounded-full bg-surface-3 px-2 py-0.5 text-xs text-faint"
                          >
                            {label}
                          </span>
                        );
                      }
                      return (
                        <Link
                          key={kind}
                          href={`/reports/attendance/${row.userId}?kind=${kind}&month=${month}`}
                          className="rounded-full bg-[var(--gold-tint)] px-2 py-0.5 text-xs font-medium text-[color:var(--gold-ink)] hover:underline"
                        >
                          {label}
                        </Link>
                      );
                    })}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </>
  );
}
