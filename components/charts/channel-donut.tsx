"use client";

import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import type { ChannelStat } from "@/lib/types";
import { formatPercent } from "@/lib/utils/format";
import { CHART_COLORS, ChartEmpty, TOOLTIP_STYLE } from "./chart-utils";

export function ChannelDonut({ data }: { data: ChannelStat[] }) {
  const chartData = data.filter((item) => item.count > 0);
  const total = chartData.reduce((sum, item) => sum + item.count, 0);

  if (!chartData.length) return <ChartEmpty label="还没有来源数据" />;

  return (
    <div className="flex flex-col items-center gap-4 sm:flex-row">
      <div className="relative h-[190px] w-full max-w-[210px] shrink-0">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={chartData}
              dataKey="count"
              nameKey="label"
              innerRadius={52}
              outerRadius={78}
              paddingAngle={2}
              strokeWidth={0}
            >
              {chartData.map((entry, index) => (
                <Cell key={entry.key} fill={CHART_COLORS[index % CHART_COLORS.length]} />
              ))}
            </Pie>
            <Tooltip
              contentStyle={TOOLTIP_STYLE}
              formatter={(value) => [`${value} 次`, "来源"]}
            />
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <div className="text-xl font-semibold tabular-nums">{total}</div>
          <div className="text-[10px] text-muted-foreground">来源记录</div>
        </div>
      </div>

      <div className="grid w-full grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-1">
        {chartData.slice(0, 6).map((item, index) => (
          <div key={item.key} className="flex items-center gap-2 text-xs">
            <span
              className="size-2 shrink-0 rounded-full"
              style={{ background: CHART_COLORS[index % CHART_COLORS.length] }}
            />
            <span className="min-w-0 flex-1 truncate text-muted-foreground">{item.label}</span>
            <span className="tabular-nums text-foreground">{formatPercent(item.share)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
