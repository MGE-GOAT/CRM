"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
  PieChart,
  Pie,
  Legend,
} from "recharts";
import { formatToman, formatNumber, toFa } from "@/lib/format";

// Warm gold + earthy material ramp (bronze → ochre → brand gold → copper),
// so the pipeline reads as one on-brand palette instead of stock chart colors.
const STAGE_COLORS = ["#a0885a", "#c9973c", "#e2b55d", "#9c5f2b"];

const AXIS_TICK = "var(--muted)";
const TOOLTIP_STYLE = {
  fontFamily: "var(--font-vazir)",
  direction: "rtl" as const,
  background: "var(--surface)",
  border: "1px solid var(--border)",
  borderRadius: 12,
  boxShadow: "var(--shadow-md)",
  color: "var(--text)",
};

export function DashboardCharts({
  stageData,
}: {
  stageData: { stage: string; value: number; count: number }[];
}) {
  const pieData = stageData.map((s) => ({ name: s.stage, value: s.count }));

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <div className="panel p-5 lg:col-span-2">
        <h2 className="mb-4 font-bold tracking-tight">ارزش معاملات بر اساس مرحله</h2>
        <div className="h-56 sm:h-64" dir="ltr">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={stageData}>
              <XAxis
                dataKey="stage"
                tick={{ fontSize: 12, fill: AXIS_TICK, fontFamily: "var(--font-vazir)" }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tick={{ fontSize: 12, fill: AXIS_TICK }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(v) => toFa(`${(v / 1_000_000).toFixed(0)}م`)}
              />
              <Tooltip
                formatter={(v) => [formatToman(Number(v)), "ارزش"]}
                cursor={{ fill: "var(--gold-tint)" }}
                contentStyle={TOOLTIP_STYLE}
                itemStyle={{ color: "var(--text)" }}
                labelStyle={{ color: "var(--muted)" }}
              />
              <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                {stageData.map((_, i) => (
                  <Cell key={i} fill={STAGE_COLORS[i % STAGE_COLORS.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="panel p-5">
        <h2 className="mb-4 font-bold tracking-tight">معاملات بر اساس مرحله</h2>
        <div className="h-56 sm:h-64" dir="ltr">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={pieData}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="50%"
                innerRadius={45}
                outerRadius={80}
                paddingAngle={2}
              >
                {pieData.map((_, i) => (
                  <Cell key={i} fill={STAGE_COLORS[i % STAGE_COLORS.length]} />
                ))}
              </Pie>
              <Legend
                iconType="circle"
                wrapperStyle={{ fontSize: 12, fontFamily: "var(--font-vazir)", color: "var(--muted)" }}
              />
              <Tooltip
                formatter={(v) => [formatNumber(Number(v)), "تعداد"]}
                contentStyle={TOOLTIP_STYLE}
                itemStyle={{ color: "var(--text)" }}
                labelStyle={{ color: "var(--muted)" }}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
