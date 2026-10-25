import { AlertTriangle, CheckCircle2, Info } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { Insight } from "@/lib/types";
import { cn } from "cn";

const TONE_META = {
  positive: {
    icon: CheckCircle2,
    className: "text-emerald-600 dark:text-emerald-400",
    bg: "bg-emerald-500/10",
  },
  warning: {
    icon: AlertTriangle,
    className: "text-amber-600 dark:text-amber-400",
    bg: "bg-amber-500/10",
  },
  neutral: {
    icon: Info,
    className: "text-chart-1",
    bg: "bg-chart-1/10",
  },
} as const;

export function InsightList({ insights }: { insights: Insight[] }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">关键发现</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {insights.length === 0 && (
          <p className="text-sm text-muted-foreground">跑完一个批次后，这里会自动生成结论。</p>
        )}
        {insights.map((insight) => {
          const meta = TONE_META[insight.tone];
          const Icon = meta.icon;
          return (
            <div key={insight.title} className="flex gap-3">
              <span
                className={cn(
                  "mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-lg",
                  meta.bg,
                  meta.className,
                )}
              >
                <Icon className="size-4" />
              </span>
              <div className="min-w-0 space-y-0.5">
                <div className="text-sm font-medium">{insight.title}</div>
                <p className="text-xs leading-5 text-muted-foreground">{insight.description}</p>
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
