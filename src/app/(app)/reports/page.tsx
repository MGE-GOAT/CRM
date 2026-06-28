import { TrendingUp, Coins, Target, Percent } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/rbac";
import { PageHeader } from "@/components/page-header";
import { Avatar } from "@/components/ui/avatar";
import { formatToman, formatNumber, formatPercent } from "@/lib/format";
import { stageLabel } from "@/lib/labels";

export const dynamic = "force-dynamic";

const OPEN_STAGES = ["LEAD", "QUALIFIED", "PROPOSAL", "NEGOTIATION"] as const;

export default async function ReportsPage() {
  await requireRole("OWNER", "ADMIN");

  const [deals, users] = await Promise.all([
    prisma.deal.findMany({
      select: { value: true, stage: true, status: true, probability: true, ownerId: true, source: true },
    }),
    prisma.user.findMany({ select: { id: true, name: true, avatarColor: true } }),
  ]);

  const num = (v: unknown) => Number(v ?? 0);
  const open = deals.filter((d) => d.status === "OPEN");
  const won = deals.filter((d) => d.status === "WON");
  const lost = deals.filter((d) => d.status === "LOST");

  // ── KPIs ──────────────────────────────────────────────────────────
  const weighted = open.reduce((s, d) => s + num(d.value) * (d.probability / 100), 0);
  const openValue = open.reduce((s, d) => s + num(d.value), 0);
  const wonValue = won.reduce((s, d) => s + num(d.value), 0);
  const closedCount = won.length + lost.length;
  const winRate = closedCount ? Math.round((won.length / closedCount) * 100) : 0;

  const kpis = [
    { label: "پیش‌بینی فروش (وزنی)", value: formatToman(weighted), icon: Target, accent: "#b08400", hint: "مجموع ارزش × احتمال معاملات باز" },
    { label: "ارزش معاملات باز", value: formatToman(openValue), icon: Coins, accent: "#0ea5e9" },
    { label: "درآمد موفق", value: formatToman(wonValue), icon: TrendingUp, accent: "#10b981" },
    { label: "نرخ موفقیت", value: formatPercent(winRate), icon: Percent, accent: "#10b981", hint: "از معاملات بسته‌شده" },
  ];

  // ── Funnel (distribution by current stage) ────────────────────────
  const funnel = [...OPEN_STAGES, "WON"].map((stage) => {
    const rows = deals.filter((d) => d.stage === stage);
    return {
      stage,
      count: rows.length,
      value: rows.reduce((s, d) => s + num(d.value), 0),
    };
  });
  const funnelMax = Math.max(1, ...funnel.map((f) => f.count));

  // ── Team performance ──────────────────────────────────────────────
  const team = users
    .map((u) => {
      const mine = deals.filter((d) => d.ownerId === u.id);
      const w = mine.filter((d) => d.status === "WON");
      const l = mine.filter((d) => d.status === "LOST");
      const o = mine.filter((d) => d.status === "OPEN");
      const closed = w.length + l.length;
      return {
        id: u.id,
        name: u.name,
        color: u.avatarColor,
        wonValue: w.reduce((s, d) => s + num(d.value), 0),
        wonCount: w.length,
        openValue: o.reduce((s, d) => s + num(d.value), 0),
        winRate: closed ? Math.round((w.length / closed) * 100) : 0,
      };
    })
    .sort((a, b) => b.wonValue - a.wonValue);
  const teamMax = Math.max(1, ...team.map((t) => t.wonValue));

  // ── Campaign attribution (by source) ──────────────────────────────
  const sourceMap = new Map<string, { count: number; total: number; wonValue: number }>();
  for (const d of deals) {
    const key = d.source || "نامشخص";
    const cur = sourceMap.get(key) ?? { count: 0, total: 0, wonValue: 0 };
    cur.count += 1;
    cur.total += num(d.value);
    if (d.status === "WON") cur.wonValue += num(d.value);
    sourceMap.set(key, cur);
  }
  const campaigns = [...sourceMap.entries()]
    .map(([source, v]) => ({ source, ...v }))
    .sort((a, b) => b.wonValue - a.wonValue);
  const campaignMax = Math.max(1, ...campaigns.map((c) => c.wonValue || c.total));

  return (
    <div>
      <PageHeader title="گزارش‌ها و تحلیل فروش" subtitle="پیش‌بینی، قیف، عملکرد تیم و اثر کمپین‌ها" />
      <div className="space-y-6 p-4 sm:p-6">
        {/* KPIs */}
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {kpis.map((k) => (
            <div key={k.label} className="rounded-xl border border-border bg-surface p-4">
              <div className="grid h-9 w-9 place-items-center rounded-lg" style={{ backgroundColor: `${k.accent}1a`, color: k.accent }}>
                <k.icon size={18} />
              </div>
              <div className="mt-3 text-lg font-bold tabular-nums sm:text-2xl">{k.value}</div>
              <div className="text-sm text-muted">{k.label}</div>
              {k.hint && <div className="mt-0.5 text-xs text-muted">{k.hint}</div>}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {/* Funnel */}
          <section className="rounded-xl border border-border bg-surface">
            <div className="border-b border-border px-5 py-4">
              <h2 className="font-semibold">قیف فروش</h2>
            </div>
            <div className="space-y-3 p-5">
              {funnel.map((f) => (
                <div key={f.stage}>
                  <div className="mb-1 flex items-center justify-between text-sm">
                    <span className="font-medium">{stageLabel[f.stage]}</span>
                    <span className="text-muted">
                      {formatNumber(f.count)} معامله · {formatToman(f.value)}
                    </span>
                  </div>
                  <div
                    className="h-2.5 overflow-hidden rounded-full bg-gray-100"
                    role="progressbar"
                    aria-label={`${stageLabel[f.stage]}: ${f.count} معامله`}
                    aria-valuenow={f.count}
                    aria-valuemin={0}
                    aria-valuemax={funnelMax}
                  >
                    <div
                      className="h-full rounded-full"
                      style={{ width: `${(f.count / funnelMax) * 100}%`, backgroundColor: f.stage === "WON" ? "#10b981" : "var(--brand)" }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Campaign attribution */}
          <section className="rounded-xl border border-border bg-surface">
            <div className="border-b border-border px-5 py-4">
              <h2 className="font-semibold">اثر کمپین‌ها (منبع)</h2>
            </div>
            <div className="space-y-3 p-5">
              {campaigns.length === 0 && <p className="text-sm text-muted">داده‌ای نیست.</p>}
              {campaigns.map((c) => (
                <div key={c.source}>
                  <div className="mb-1 flex items-center justify-between text-sm">
                    <span className="font-medium">{c.source}</span>
                    <span className="text-muted">
                      {formatNumber(c.count)} معامله · موفق {formatToman(c.wonValue)}
                    </span>
                  </div>
                  <div
                    className="h-2.5 overflow-hidden rounded-full bg-gray-100"
                    role="progressbar"
                    aria-label={`${c.source}: ${formatToman(c.wonValue)} موفق`}
                    aria-valuenow={Math.round(c.wonValue || c.total)}
                    aria-valuemin={0}
                    aria-valuemax={Math.round(campaignMax)}
                  >
                    <div className="h-full rounded-full bg-[var(--brand)]" style={{ width: `${((c.wonValue || c.total) / campaignMax) * 100}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>

        {/* Team performance */}
        <section className="overflow-x-auto rounded-xl border border-border bg-surface">
          <div className="border-b border-border px-5 py-4">
            <h2 className="font-semibold">عملکرد تیم فروش</h2>
          </div>
          <table className="w-full min-w-[640px] text-sm">
            <thead className="border-b border-border bg-gray-50 text-right text-xs text-muted">
              <tr>
                <th className="px-5 py-3 font-medium">عضو</th>
                <th className="px-4 py-3 font-medium">درآمد موفق</th>
                <th className="px-4 py-3 font-medium">تعداد موفق</th>
                <th className="px-4 py-3 font-medium">پایپلاین باز</th>
                <th className="px-4 py-3 font-medium">نرخ موفقیت</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {team.map((t) => (
                <tr key={t.id} className="hover:bg-gray-50/60">
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-2.5">
                      <Avatar name={t.name} color={t.color} size={30} />
                      <span className="font-medium">{t.name}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="font-medium">{formatToman(t.wonValue)}</div>
                    <div className="mt-1 h-1.5 w-28 overflow-hidden rounded-full bg-gray-100">
                      <div className="h-full rounded-full bg-emerald-500" style={{ width: `${(t.wonValue / teamMax) * 100}%` }} />
                    </div>
                  </td>
                  <td className="px-4 py-3 text-muted">{formatNumber(t.wonCount)}</td>
                  <td className="px-4 py-3 text-muted">{formatToman(t.openValue)}</td>
                  <td className="px-4 py-3 text-muted">{formatPercent(t.winRate)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      </div>
    </div>
  );
}
