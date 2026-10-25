"use client";

import { BarChart3 } from "lucide-react";

export function ChartEmpty({ label = "暂无数据" }: { label?: string }) {
  return (
    <div className="flex h-[220px] flex-col items-center justify-center gap-2 text-xs text-muted-foreground">
      <BarChart3 className="size-5 opacity-50" />
      {label}
    </div>
  );
}

export const CHART_COLORS = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
];

export const TOOLTIP_STYLE = {
  background: "var(--popover)",
  border: "1px solid var(--border)",
  borderRadius: 10,
  fontSize: 12,
  color: "var(--popover-foreground)",
  boxShadow: "0 8px 24px rgb(0 0 0 / 0.12)",
} as const;
