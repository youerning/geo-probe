"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { DomainStat } from "@/lib/types";
import { ChartEmpty, TOOLTIP_STYLE } from "./chart-utils";

export function TopDomainsChart({ data }: { data: DomainStat[] }) {
  const chartData = data.slice(0, 8).map((item) => ({
    label:
      item.domain.length > 22 ? `${item.domain.slice(0, 20)}…` : item.domain || item.platform,
    domain: item.domain,
    platform: item.platform,
    value: Number((item.appearanceRate * 100).toFixed(1)),
    rank: Number(item.avgRank.toFixed(1)),
    probes: item.probeCount,
  }));

  if (!chartData.length) return <ChartEmpty label="还没有来源域名" />;

  return (
    <ResponsiveContainer width="100%" height={260}>
      <BarChart
        data={chartData}
        layout="vertical"
        margin={{ left: 4, right: 28, top: 4, bottom: 4 }}
        barCategoryGap={8}
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
          width={104}
          tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
          axisLine={false}
          tickLine={false}
        />
        <Tooltip
          cursor={{ fill: "var(--muted)", opacity: 0.5 }}
          contentStyle={TOOLTIP_STYLE}
          formatter={(value) => [`${value}%`, "出现率"]}
        />
        <Bar dataKey="value" fill="var(--chart-2)" radius={[0, 6, 6, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
