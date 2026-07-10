import Link from "next/link";
import { TrendingUp, Users, Building2, CheckSquare, Coins } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/page-header";
import { Avatar } from "@/components/ui/avatar";
import { formatToman, formatRelative, formatNumber } from "@/lib/format";
import { stageLabel, activityTypeLabel } from "@/lib/labels";
import { DashboardCharts } from "./dashboard-charts";

export default async function DashboardPage() {
  const [
    contactCount,
    companyCount,
    openDeals,
    wonDeals,
    openTasks,
    pipelineByStage,
    recentActivities,
  ] = await Promise.all([
    prisma.contact.count(),
    prisma.company.count(),
    prisma.deal.findMany({ where: { status: "OPEN" }, select: { value: true } }),
    prisma.deal.findMany({ where: { status: "WON" }, select: { value: true } }),
    prisma.task.count({ where: { completed: false } }),
    prisma.deal.groupBy({
      by: ["stage"],
      _sum: { value: true },
      _count: true,
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

  const openValue = openDeals.reduce((s, d) => s + Number(d.value), 0);
  const wonValue = wonDeals.reduce((s, d) => s + Number(d.value), 0);

  const STAGE_ORDER = ["LEAD", "QUALIFIED", "PROPOSAL", "NEGOTIATION"];
  const stageData = STAGE_ORDER.map((stage) => {
    const row = pipelineByStage.find((p) => p.stage === stage);
    return {
      stage: stageLabel[stage],
      value: Number(row?._sum.value ?? 0),
      count: row?._count ?? 0,
    };
  });

  // One promoted "hero" figure (the active pipeline) carries the gold; the rest
  // are demoted to compact tiles with a warm, earthy material accent each.
  const heroStat = { label: "معاملات باز", value: formatToman(openValue), icon: Coins };
  const stats = [
    { label: "درآمد موفق", value: formatToman(wonValue), icon: TrendingUp, accent: "#047857" },
    { label: "مخاطبین", value: formatNumber(contactCount), icon: Users, accent: "#8a6d3b" },
    { label: "شرکت‌ها", value: formatNumber(companyCount), icon: Building2, accent: "#a15c38" },
    { label: "وظایف باز", value: formatNumber(openTasks), icon: CheckSquare, accent: "#b45309" },
  ];

  return (
    <div>
      <PageHeader title="داشبورد" subtitle="نمای کلی فروش تیم شما" />
      <div className="space-y-6 p-4 sm:p-6">
        {/* Stat cards — one gold hero + four demoted tiles */}
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <div className="panel col-span-2 flex flex-col justify-between gap-6 p-5 lg:row-span-2 lg:p-6">
            <div className="grid h-11 w-11 place-items-center rounded-xl bg-[var(--gold-tint)] text-[color:var(--gold-ink)]">
              <heroStat.icon size={22} />
            </div>
            <div>
              <div className="text-3xl font-bold tracking-tight text-[color:var(--gold-ink)] sm:text-4xl">
                {heroStat.value}
              </div>
              <div className="mt-1 text-sm font-medium text-muted">{heroStat.label}</div>
            </div>
          </div>
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

        {/* Charts */}
        <DashboardCharts stageData={stageData} />

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
      </div>
    </div>
  );
}
