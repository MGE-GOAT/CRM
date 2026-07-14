import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/rbac";
import { PageHeader } from "@/components/page-header";
import { StateBadge } from "@/components/ui/factor-badge";
import { PAYMENT_KIND_LABEL } from "@/lib/factor";
import { factorPayable } from "@/lib/factor-total";
import { formatDate, formatNumber, formatRial, toFa } from "@/lib/format";
import type { PaymentKind } from "@prisma/client";
import { monthRange, normalizeMonth, formatMonthLabel } from "@/lib/attendance-report";

const PAYMENT_KINDS: PaymentKind[] = ["CASH", "CHEQUE", "HALF_HALF"];

function normalizeKind(kind: string | undefined): PaymentKind {
  return kind && PAYMENT_KINDS.includes(kind as PaymentKind)
    ? (kind as PaymentKind)
    : "CASH";
}

/**
 * OWNER-only drill-down: every paid factor of one payment kind created by a
 * given member within a Tehran month. Reached from the attendance report chips.
 */
export default async function AttendanceDrilldownPage({
  params,
  searchParams,
}: {
  params: Promise<{ userId: string }>;
  searchParams: Promise<{ kind?: string; month?: string }>;
}) {
  await requireRole("OWNER");
  const { userId } = await params;
  const { kind: kindParam, month: monthParam } = await searchParams;

  const kind = normalizeKind(kindParam);
  const month = normalizeMonth(monthParam);
  const { start, end } = monthRange(month);

  const [member, factors] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: { name: true },
    }),
    prisma.factor.findMany({
      where: {
        parentFactorId: null,
        creatorId: userId,
        paymentKind: kind,
        paidAt: { gte: start, lt: end },
        state: { in: ["PAID", "SENDING", "EXIT"] },
      },
      include: { items: { select: { metrage: true, quantity: true, unitPrice: true } } },
      orderBy: { paidAt: "desc" },
    }),
  ]);
  if (!member) notFound();

  const backHref = `/?month=${month}`;

  return (
    <div>
      <PageHeader
        title={`فاکتورهای پرداخت‌شده — ${member.name}`}
        subtitle={`نوع: ${PAYMENT_KIND_LABEL[kind]} · ${formatMonthLabel(month)}`}
      />
      <div className="space-y-4 p-4 sm:p-6">
        <Link
          href={backHref}
          className="inline-flex items-center gap-1.5 text-sm font-medium text-[color:var(--gold-ink)] hover:underline"
        >
          <ArrowRight size={16} />
          بازگشت به گزارش‌ها
        </Link>

        <section className="overflow-x-auto rounded-2xl border border-border bg-surface shadow-[var(--shadow-md)]">
          <table className="w-full min-w-[640px] text-sm">
            <thead className="border-b-2 border-[color:var(--rule)] bg-surface-2 text-right text-xs tracking-wide text-muted">
              <tr>
                <th className="px-5 py-3 font-medium">شماره فاکتور</th>
                <th className="px-4 py-3 font-medium">خریدار</th>
                <th className="px-4 py-3 font-medium">مبلغ قابل پرداخت</th>
                <th className="px-4 py-3 font-medium">وضعیت</th>
                <th className="px-4 py-3 font-medium">تاریخ پرداخت</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {factors.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-5 py-6 text-muted">
                    فاکتور پرداخت‌شده‌ای برای این ماه ثبت نشده است.
                  </td>
                </tr>
              )}
              {factors.map((f) => (
                <tr key={f.id} className="hover:bg-[var(--gold-tint)]">
                  <td className="px-5 py-3">
                    <Link
                      href={`/factors/${f.id}`}
                      className="font-medium text-[var(--brand)] hover:underline"
                    >
                      {toFa(f.number)}
                    </Link>
                  </td>
                  <td className="px-4 py-3">{f.buyerName}</td>
                  <td className="px-4 py-3 tabular-nums">
                    {formatRial(factorPayable(f))}
                  </td>
                  <td className="px-4 py-3">
                    <StateBadge state={f.state} />
                  </td>
                  <td className="px-4 py-3 tabular-nums text-muted">
                    {formatDate(f.paidAt)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        <p className="text-sm text-muted">
          مجموع: {formatNumber(factors.length)} فاکتور
        </p>
      </div>
    </div>
  );
}
