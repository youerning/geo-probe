"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, History, MoreHorizontal, Play, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { RunStatusBadge } from "@/components/status-badge";
import { deleteRun } from "@/lib/db/repositories";
import type { Probe, Run } from "@/lib/types";
import { formatDateTime, formatDuration, formatPercent } from "@/lib/utils/format";

export function RunHistory({
  projectName,
  runs,
  probes,
  loading,
}: {
  projectName: string;
  runs: Run[] | undefined;
  probes: Probe[] | undefined;
  loading: boolean;
}) {
  const router = useRouter();
  const [deleting, setDeleting] = useState<Run | null>(null);

  const stats = useMemo(() => {
    if (!runs) return [];
    return runs.map((run) => {
      const group = (probes ?? []).filter((probe) => probe.runId === run.id);
      const successes = group.filter((probe) => probe.status === "success");
      const brandId =
        run.aliasSnapshot.find((target) => target.kind === "brand")?.id ?? "brand";
      const mentioned = successes.filter((probe) =>
        probe.mentions.some((mention) => mention.targetId === brandId),
      ).length;
      const durationMs =
        run.finishedAt && run.startedAt
          ? new Date(run.finishedAt).getTime() - new Date(run.startedAt).getTime()
          : null;
      return {
        run,
        probeCount: group.length,
        successCount: successes.length,
        mentionRate: successes.length ? mentioned / successes.length : null,
        durationMs,
      };
    });
  }, [runs, probes]);

  const handleDelete = async () => {
    if (!deleting) return;
    try {
      await deleteRun(deleting.id);
      toast.success("批次已删除。");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "删除失败。");
    } finally {
      setDeleting(null);
    }
  };

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="历史批次"
        title="历史批次"
        description={`项目「${projectName}」的所有探测记录。结果保存在浏览器本地。`}
        actions={
          <Button onClick={() => router.push("/run/")}>
            <Play />
            运行探测
          </Button>
        }
      />

      {loading || !runs ? (
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, index) => (
            <Skeleton key={index} className="h-14 rounded-xl" />
          ))}
        </div>
      ) : runs.length === 0 ? (
        <EmptyState
          icon={History}
          title="还没有批次"
          description="跑一次探测，这里会保存每次的提及率、来源和回答。"
          action={
            <Button onClick={() => router.push("/run/")}>
              <Play />
              运行第一次探测
            </Button>
          }
        />
      ) : (
        <Card className="overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="min-w-[220px]">批次</TableHead>
                <TableHead>状态</TableHead>
                <TableHead className="hidden sm:table-cell">模型</TableHead>
                <TableHead className="hidden text-right sm:table-cell">探测</TableHead>
                <TableHead className="text-right">提及率</TableHead>
                <TableHead className="hidden text-right md:table-cell">耗时</TableHead>
                <TableHead className="w-12" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {stats.map((item) => (
                <TableRow
                  key={item.run.id}
                  className="cursor-pointer"
                  onClick={() => router.push(`/runs/?run=${item.run.id}`)}
                >
                  <TableCell className="whitespace-normal">
                    <div className="text-sm font-medium">{item.run.name}</div>
                    <div className="text-[11px] text-muted-foreground">
                      {formatDateTime(item.run.startedAt)}
                    </div>
                  </TableCell>
                  <TableCell>
                    <RunStatusBadge status={item.run.status} />
                  </TableCell>
                  <TableCell className="hidden text-xs text-muted-foreground sm:table-cell">
                    {item.run.config.model}
                  </TableCell>
                  <TableCell className="hidden text-right text-xs tabular-nums sm:table-cell">
                    {item.successCount}/{item.run.plannedProbeCount}
                  </TableCell>
                  <TableCell className="text-right text-xs tabular-nums">
                    {item.mentionRate === null ? "—" : formatPercent(item.mentionRate)}
                  </TableCell>
                  <TableCell className="hidden text-right text-xs tabular-nums md:table-cell">
                    {item.durationMs === null ? "—" : formatDuration(item.durationMs)}
                  </TableCell>
                  <TableCell onClick={(event) => event.stopPropagation()}>
                    <DropdownMenu>
                      <DropdownMenuTrigger
                        render={
                          <Button variant="ghost" size="icon-sm" aria-label="更多操作">
                            <MoreHorizontal />
                          </Button>
                        }
                      />
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                          onClick={() => router.push(`/runs/?run=${item.run.id}`)}
                        >
                          <ArrowRight className="size-3.5" />
                          查看详情
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          variant="destructive"
                          onClick={() => setDeleting(item.run)}
                        >
                          <Trash2 className="size-3.5" />
                          删除
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}

      <AlertDialog open={!!deleting} onOpenChange={(open) => !open && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>删除这个批次？</AlertDialogTitle>
            <AlertDialogDescription>
              批次里的回答、来源和指标都会被删除，无法恢复。建议先导出 JSON 备份。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>删除</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
