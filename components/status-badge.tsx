import { Badge } from "@/components/ui/badge";
import type { ProbeStatus, RunStatus } from "@/lib/types";
import { cn } from "cn";

const RUN_STATUS: Record<RunStatus, { label: string; className: string }> = {
  queued: { label: "排队中", className: "bg-muted text-muted-foreground" },
  running: { label: "运行中", className: "bg-chart-1/15 text-chart-1" },
  completed: { label: "已完成", className: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400" },
  partial: { label: "部分失败", className: "bg-amber-500/15 text-amber-600 dark:text-amber-400" },
  failed: { label: "失败", className: "bg-destructive/15 text-destructive" },
  cancelled: { label: "已取消", className: "bg-muted text-muted-foreground" },
};

const PROBE_STATUS: Record<ProbeStatus, { label: string; className: string }> = {
  success: { label: "成功", className: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400" },
  error: { label: "失败", className: "bg-destructive/15 text-destructive" },
  empty: { label: "空回答", className: "bg-amber-500/15 text-amber-600 dark:text-amber-400" },
  cancelled: { label: "已取消", className: "bg-muted text-muted-foreground" },
};

export function RunStatusBadge({ status, className }: { status: RunStatus; className?: string }) {
  const meta = RUN_STATUS[status] ?? RUN_STATUS.queued;
  return (
    <Badge variant="secondary" className={cn("border-0 font-normal", meta.className, className)}>
      {meta.label}
    </Badge>
  );
}

export function ProbeStatusBadge({ status, className }: { status: ProbeStatus; className?: string }) {
  const meta = PROBE_STATUS[status] ?? PROBE_STATUS.error;
  return (
    <Badge variant="secondary" className={cn("border-0 font-normal", meta.className, className)}>
      {meta.label}
    </Badge>
  );
}
