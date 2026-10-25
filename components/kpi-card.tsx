import type { ComponentType, ReactNode } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "cn";

const TONES = {
  default: "bg-muted text-muted-foreground",
  positive: "bg-emerald-500/12 text-emerald-600 dark:text-emerald-400",
  warning: "bg-amber-500/12 text-amber-600 dark:text-amber-400",
  primary: "bg-primary/12 text-primary",
} as const;

export function KpiCard({
  label,
  value,
  hint,
  icon: Icon,
  tone = "default",
  footer,
  className,
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  icon?: ComponentType<{ className?: string }>;
  tone?: keyof typeof TONES;
  footer?: ReactNode;
  className?: string;
}) {
  return (
    <Card className={cn("overflow-hidden", className)}>
      <CardContent className="space-y-3 p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="text-sm font-medium text-muted-foreground">{label}</div>
          {Icon && (
            <span className={cn("flex size-8 items-center justify-center rounded-lg", TONES[tone])}>
              <Icon className="size-4" />
            </span>
          )}
        </div>
        <div className="text-3xl font-semibold tracking-tight tabular-nums">{value}</div>
        {hint && <div className="text-xs leading-5 text-muted-foreground">{hint}</div>}
        {footer}
      </CardContent>
    </Card>
  );
}
