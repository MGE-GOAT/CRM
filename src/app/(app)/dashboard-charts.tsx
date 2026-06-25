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

const STAGE_COLORS = ["#9aa0a6", "#0ea5e9", "#d4af37", "#8b5cf6"];

export function DashboardCharts({
  stageData,
}: {
  stageData: { stage: string; value: number; count: number }[];
}) {
  const pieData = stageData.map((s) => ({ name: s.stage, value: s.count }));

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <div className="rounded-xl border border-border bg-surface p-5 lg:col-span-2">
        <h2 className="mb-4 font-semibold">ارزش معاملات بر اساس مرحله</h2>
        <div className="h-56 sm:h-64" dir="ltr">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={stageData}>
              <XAxis
                dataKey="stage"
                tick={{ fontSize: 12, fill: "#6b7280", fontFamily: "var(--font-vazir)" }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tick={{ fontSize: 12, fill: "#6b7280" }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(v) => toFa(`${(v / 1_000_000).toFixed(0)}م`)}
              />
              <Tooltip
                formatter={(v) => [formatToman(Number(v)), "ارزش"]}
                cursor={{ fill: "#f3f4f6" }}
                contentStyle={{ fontFamily: "var(--font-vazir)", direction: "rtl" }}
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

      <div className="rounded-xl border border-border bg-surface p-5">
        <h2 className="mb-4 font-semibold">معاملات بر اساس مرحله</h2>
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
                wrapperStyle={{ fontSize: 12, fontFamily: "var(--font-vazir)" }}
              />
              <Tooltip
                formatter={(v) => [formatNumber(Number(v)), "تعداد"]}
                contentStyle={{ fontFamily: "var(--font-vazir)", direction: "rtl" }}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
