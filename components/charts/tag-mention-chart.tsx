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
import type { TagMetric } from "@/lib/types";
import { CHART_COLORS, ChartEmpty, TOOLTIP_STYLE } from "./chart-utils";

export function TagMentionChart({ data }: { data: TagMetric[] }) {
  const chartData = data
    .filter((item) => item.successCount > 0)
    .map((item) => ({
      label: item.label,
      tag: item.tag,
      value: Number((item.mentionRate * 100).toFixed(1)),
      count: item.mentionCount,
      total: item.successCount,
    }));

  if (!chartData.length) return <ChartEmpty label="还没有可分组的数据" />;

  return (
    <ResponsiveContainer width="100%" height={250}>
      <BarChart
        data={chartData}
        layout="vertical"
        margin={{ left: 4, right: 28, top: 4, bottom: 4 }}
        barCategoryGap={10}
      >
        <CartesianGrid horizontal={false} stroke="var(--border)" strokeDasharray="3 3" />
        <XAxis
          type="number"
          domain={[0, 100]}
          tickFormatter={(value) => `${value}%`}
          tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          type="category"
          dataKey="label"
          width={72}
          tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
          axisLine={false}
          tickLine={false}
        />
        <Tooltip
          cursor={{ fill: "var(--muted)", opacity: 0.5 }}
          contentStyle={TOOLTIP_STYLE}
          formatter={(value) => [`${value}%`, "提及率"]}
        />
        <Bar dataKey="value" radius={[0, 6, 6, 0]}>
          {chartData.map((entry, index) => (
            <Cell key={entry.tag} fill={CHART_COLORS[index % CHART_COLORS.length]} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
