import Link from "next/link";
import type { PromptMetrics } from "@/lib/types";
import { formatPercent } from "@/lib/utils/format";
import { TagList } from "@/components/tag-badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "cn";

function RateCell({ value }: { value: number }) {
  return (
    <div className="flex min-w-[86px] items-center gap-2">
      <span className="w-11 text-right text-xs tabular-nums">{formatPercent(value)}</span>
      <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
        <span
          className="block h-full rounded-full bg-chart-1"
          style={{ width: `${Math.min(100, value * 100)}%` }}
        />
      </span>
    </div>
  );
}

export function PromptMetricsTable({
  metrics,
  runId,
  emptyLabel = "还没有 Prompt 数据",
  className,
  onSelectPrompt,
  selectedPromptId,
}: {
  metrics: PromptMetrics[];
  runId?: string;
  emptyLabel?: string;
  className?: string;
  onSelectPrompt?: (promptId: string) => void;
  selectedPromptId?: string | null;
}) {
  if (!metrics.length) {
    return (
      <div className="py-10 text-center text-sm text-muted-foreground">{emptyLabel}</div>
    );
  }

  return (
    <Table className={className}>
      <TableHeader>
        <TableRow>
          <TableHead className="min-w-[260px]">提示词</TableHead>
          <TableHead>标签</TableHead>
          <TableHead className="text-right">提及率</TableHead>
          <TableHead className="hidden text-right sm:table-cell">首位率</TableHead>
          <TableHead className="hidden text-right md:table-cell">平均位次</TableHead>
          <TableHead className="hidden text-right md:table-cell">来源稳定性</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {metrics.map((metric) => (
          <TableRow key={metric.promptId} className="group">
            <TableCell
              className={cn(
                "max-w-[380px] whitespace-normal",
                onSelectPrompt && "cursor-pointer",
                selectedPromptId === metric.promptId && "bg-muted/40",
              )}
              onClick={() => onSelectPrompt?.(metric.promptId)}
            >
              {onSelectPrompt ? (
                <span className="line-clamp-2 text-sm hover:text-primary">{metric.text}</span>
              ) : runId ? (
                <Link
                  href={`/runs/?run=${runId}&tab=prompts&prompt=${metric.promptId}`}
                  className="line-clamp-2 text-sm hover:text-primary"
                >
                  {metric.text}
                </Link>
              ) : (
                <span className="line-clamp-2 text-sm">{metric.text}</span>
              )}
              <div className="mt-0.5 text-[11px] text-muted-foreground">
                {metric.mentionCount}/{metric.successCount} 次命中
              </div>
            </TableCell>
            <TableCell>
              <TagList tags={metric.tags} />
            </TableCell>
            <TableCell>
              <RateCell value={metric.mentionRate} />
            </TableCell>
            <TableCell className="hidden text-right text-xs tabular-nums sm:table-cell">
              {formatPercent(metric.firstRate)}
            </TableCell>
            <TableCell className="hidden text-right text-xs tabular-nums md:table-cell">
              {metric.avgOrder ? metric.avgOrder.toFixed(1) : "—"}
            </TableCell>
            <TableCell
              className={cn(
                "hidden text-right text-xs tabular-nums md:table-cell",
                metric.sourceStability !== null && metric.sourceStability < 0.4 && "text-amber-600 dark:text-amber-400",
              )}
            >
              {metric.sourceStability === null ? "—" : formatPercent(metric.sourceStability)}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
