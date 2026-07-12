import Link from "next/link";
import { Users, Building2, CheckSquare, FileText, FileClock, ChevronLeft } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireUser, isOwner, canManageUsers } from "@/lib/rbac";
import { PageHeader } from "@/components/page-header";
import { Avatar } from "@/components/ui/avatar";
import { formatRelative, formatNumber } from "@/lib/format";
import { activityTypeLabel } from "@/lib/labels";
import { AttendanceSection } from "./attendance-section";
import { MonthArchiveSection } from "./month-archive-section";
import { AutoRefresh } from "@/components/chat/auto-refresh";
import {
  normalizeMonth,
  monthRange,
  recentMonths,
  currentTehranMonth,
  formatMonthLabel,
} from "@/lib/attendance-report";

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string | string[]; user?: string | string[] }>;
}) {
  const { month: monthRaw, user: userRaw } = await searchParams;
  // searchParams values may be arrays (?user=a&user=b) — take a single string.
  const monthParam = typeof monthRaw === "string" ? monthRaw : undefined;
  const userParam = typeof userRaw === "string" ? userRaw : undefined;
  const user = await requireUser();
  const manager = canManageUsers(user.role);
  const showAttendance = isOwner(user.role);
  const month = normalizeMonth(monthParam);
  const { start, end } = monthRange(month);
  const [
    contactCount,
    companyCount,
    openTasks,
    pendingFactors,
    paidThisMonth,
    recentActivities,
  ] = await Promise.all([
    prisma.contact.count(),
    prisma.company.count(),
    prisma.task.count({ where: { completed: false } }),
    // Pre-factors awaiting the owner's action (INITIAL/FOLLOWING_UP).
    prisma.factor.count({ where: { parentFactorId: null, state: { in: ["INITIAL", "FOLLOWING_UP"] } } }),
    // Factors marked paid within the selected month.
    prisma.factor.count({
      where: {
        parentFactorId: null,
        paidAt: { gte: start, lt: end },
        state: { in: ["PAID", "SENDING", "EXIT"] },
      },
    }),
    prisma.activity.findMany({
      take: 8,
      orderBy: { createdAt: "desc" },
      include: {
        user: { select: { name: true, avatarColor: true } },
        deal: { select: { id: true, title: true } },
        contact: { select: { id: true, firstName: true, lastName: true } },
      },
    }),
  ]);

  // The pending pre-factors carry the gold hero (the number that needs action);
  // the rest are demoted to compact tiles with a warm, earthy accent each.
  const heroStat = {
    label: "پیش‌فاکتورهای در انتظار",
    value: formatNumber(pendingFactors),
    icon: FileClock,
  };
  // Paid-factor counts are an owner/admin (manager) metric — members don't see
  // paid-onward factors anywhere, so this tile is manager-only.
  const stats = [
    ...(manager
      ? [{ label: "فاکتورهای پرداخت‌شده (این ماه)", value: formatNumber(paidThisMonth), icon: FileText, accent: "#047857" }]
      : []),
    { label: "مخاطبین", value: formatNumber(contactCount), icon: Users, accent: "#8a6d3b" },
    { label: "شرکت‌ها", value: formatNumber(companyCount), icon: Building2, accent: "#a15c38" },
    { label: "وظایف باز", value: formatNumber(openTasks), icon: CheckSquare, accent: "#b45309" },
  ];

  return (
    <div>
      <AutoRefresh interval={25000} />
      <PageHeader title="گزارش‌ها" subtitle="نمای کلی فروش تیم شما" />
      <div className="space-y-6 p-4 sm:p-6">
        {/* Stat cards — one gold hero + four demoted tiles */}
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <Link
            href="/factors"
            className="panel group col-span-2 flex flex-col justify-between gap-6 p-5 transition hover:shadow-[var(--shadow-md)] lg:row-span-2 lg:p-6"
          >
            <div className="flex items-start justify-between">
              <div className="grid h-11 w-11 place-items-center rounded-xl bg-[var(--gold-tint)] text-[color:var(--gold-ink)]">
                <heroStat.icon size={22} />
              </div>
              <ChevronLeft
                size={20}
                aria-hidden="true"
                className="text-faint transition group-hover:-translate-x-0.5 group-hover:text-[color:var(--gold-ink)]"
              />
            </div>
            <div>
              <div className="text-4xl font-bold tracking-tight text-[color:var(--gold-ink)] sm:text-5xl">
                {heroStat.value}
              </div>
              <div className="mt-1 text-sm font-semibold text-text">{heroStat.label}</div>
              <div className="mt-1 text-xs text-muted">
                برای بررسی و تأیید، وارد فاکتورها شوید
              </div>
            </div>
          </Link>
          {stats.map((s) => (
            <div
              key={s.label}
              className="rounded-2xl border border-border bg-surface p-4 shadow-[var(--shadow-sm)]"
            >
              <div
                className="grid h-9 w-9 place-items-center rounded-lg"
                style={{ backgroundColor: `${s.accent}1a`, color: s.accent }}
              >
                <s.icon size={18} />
              </div>
              <div className="mt-3 text-xl font-bold tracking-tight">{s.value}</div>
              <div className="text-sm text-muted">{s.label}</div>
            </div>
          ))}
        </div>

        {/* Recent activity */}
        <div className="panel">
          <div className="border-b border-border px-5 py-4">
            <h2 className="font-bold tracking-tight">فعالیت‌های اخیر</h2>
          </div>
          <ul className="divide-y divide-border">
            {recentActivities.length === 0 && (
              <li className="px-5 py-6 text-sm text-muted">هنوز فعالیتی ثبت نشده است.</li>
            )}
            {recentActivities.map((a) => (
              <li key={a.id} className="flex items-start gap-3 px-5 py-3">
                <Avatar name={a.user.name} color={a.user.avatarColor} size={28} />
                <div className="min-w-0 flex-1 text-sm">
                  <span className="font-medium">{a.user.name}</span>{" "}
                  <span className="text-muted">
                    {a.type === "STAGE_CHANGE"
                      ? a.content
                      : `${activityTypeLabel[a.type] ?? a.type} ثبت کرد — ${a.content}`}
                  </span>
                  {a.deal && (
                    <>
                      {" "}
                      <Link
                        href={`/deals`}
                        className="text-[var(--brand)] hover:underline"
                      >
                        {a.deal.title}
                      </Link>
                    </>
                  )}
                  <div className="text-xs text-muted">
                    {formatRelative(a.createdAt)}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </div>

        {/* Owner-only attendance + activity report */}
        {showAttendance && <AttendanceSection month={month} userId={userParam} />}

        {/* Owner-only monthly archive + close-month */}
        {showAttendance && <MonthArchiveSection {...(await getArchiveData())} />}
      </div>
    </div>
  );
}

/** Archived months + the past months still open for closing (owner section). */
async function getArchiveData() {
  const archived = await prisma.monthlyArchive.findMany({
    orderBy: { month: "desc" },
    select: { month: true, factorCount: true, attendanceCount: true, createdAt: true },
  });
  const archivedSet = new Set(archived.map((a) => a.month));
  const current = currentTehranMonth();
  const closable = recentMonths(12)
    .filter((m) => m < current && !archivedSet.has(m))
    .map((m) => ({ month: m, label: formatMonthLabel(m) }));
  return {
    archives: archived.map((a) => ({
      month: a.month,
      label: formatMonthLabel(a.month),
      factorCount: a.factorCount,
      attendanceCount: a.attendanceCount,
      createdAt: a.createdAt.toISOString(),
    })),
    closable,
  };
}
