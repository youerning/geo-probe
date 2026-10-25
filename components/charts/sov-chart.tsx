"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { SovItem } from "@/lib/types";
import { CHART_COLORS, ChartEmpty, TOOLTIP_STYLE } from "./chart-utils";

export function SovChart({ data }: { data: SovItem[] }) {
  const chartData = data
    .filter((item) => item.mentionCount > 0)
    .map((item) => ({
      label: item.label,
      kind: item.kind,
      value: item.mentionCount,
      share: item.share,
    }));

  if (!chartData.length) return <ChartEmpty label="还没有命中任何追踪目标" />;

  return (
    <ResponsiveContainer width="100%" height={Math.max(180, chartData.length * 42)}>
      <BarChart
        data={chartData}
        layout="vertical"
        margin={{ left: 4, right: 36, top: 4, bottom: 4 }}
        barCategoryGap={8}
      >
        <CartesianGrid horizontal={false} stroke="var(--border)" strokeDasharray="3 3" />
        <XAxis
          type="number"
          allowDecimals={false}
          tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          type="category"
          dataKey="label"
          width={76}
          tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
          axisLine={false}
          tickLine={false}
        />
        <Tooltip
          cursor={{ fill: "var(--muted)", opacity: 0.5 }}
          contentStyle={TOOLTIP_STYLE}
          formatter={(value) => [`${value} 次`, "声量"]}
        />
        <Bar dataKey="value" radius={[0, 6, 6, 0]}>
          {chartData.map((entry, index) => (
            <Cell
              key={entry.label}
              fill={entry.kind === "brand" ? "var(--chart-1)" : CHART_COLORS[(index + 1) % CHART_COLORS.length]}
            />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
