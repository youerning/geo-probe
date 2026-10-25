"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Download,
  FileJson,
  FileSpreadsheet,
  FileText,
  History,
  Loader2,
  MoreHorizontal,
  RefreshCw,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { RunStatusBadge } from "@/components/status-badge";
import { ProbeDrawer } from "@/components/probe-drawer";
import { DomainDrawer } from "@/components/domain-drawer";
import { OverviewTab } from "@/components/runs/overview-tab";
import { PromptsTab } from "@/components/runs/prompts-tab";
import { SourcesTab } from "@/components/runs/sources-tab";
import { LeaderboardTab } from "@/components/runs/leaderboard-tab";
import { StabilityTab } from "@/components/runs/stability-tab";
import { computePromptMetricsList, computeRunMetrics, emptyRunMetrics } from "@/lib/analysis/metrics";
import { deleteRun } from "@/lib/db/repositories";
import { downloadRunProbesCsv, downloadRunSourcesCsv, downloadTextFile } from "@/lib/export/files";
import { downloadRunJson } from "@/lib/export/files";
import { runToMarkdown } from "@/lib/export/markdown";
import { useApiKey } from "@/lib/hooks/use-api-key";
import { useAppSettings } from "@/lib/hooks/use-app-settings";
import { useProject, useProbes, useRun } from "@/lib/hooks/use-data";
import { retryFailedProbes, resumeRun } from "@/lib/runner";
import type { Prompt } from "@/lib/types";
import { formatDateTime } from "@/lib/utils/format";

const TABS = ["overview", "prompts", "sources", "leaderboard", "stability"] as const;
type TabKey = (typeof TABS)[number];

export function RunDetail({
  runId,
  tab,
  promptId,
  probeId,
  domain,
  onUpdateParams,
}: {
  runId: string;
  tab: string;
  promptId: string | null;
  probeId: string | null;
  domain: string | null;
  onUpdateParams: (patch: Record<string, string | null>) => void;
}) {
  const router = useRouter();
  const run = useRun(runId);
  const probes = useProbes(runId);
  const previousProbes = useProbes(run?.previousRunId);
  const project = useProject(run?.projectId);
  const apiKey = useApiKey();
  const { settings } = useAppSettings();
  const [deleting, setDeleting] = useState(false);
  const [busy, setBusy] = useState(false);

  const effectivePrompts: Prompt[] = useMemo(() => {
    if (!run) return [];
    return run.promptSnapshot.map((prompt) => ({
      id: prompt.id,
      projectId: run.projectId,
      text: prompt.text,
      tags: prompt.tags,
      enabled: true,
      createdAt: run.createdAt,
      updatedAt: run.createdAt,
    }));
  }, [run]);

  const metrics = useMemo(() => {
    if (!run || !probes) return emptyRunMetrics();
    return computeRunMetrics({
      run,
      probes,
      prompts: effectivePrompts,
      previousProbes: previousProbes ?? [],
    });
  }, [run, probes, effectivePrompts, previousProbes]);

  const brandId =
    run?.aliasSnapshot.find((target) => target.kind === "brand")?.id ?? "brand";
  const promptMetrics = useMemo(
    () => computePromptMetricsList(effectivePrompts, probes ?? [], brandId),
    [effectivePrompts, probes, brandId],
  );

  const activeTab = (TABS.includes(tab as TabKey) ? tab : "overview") as TabKey;
  const activeProbe = probes?.find((probe) => probe.id === probeId);
  const activeDomain = metrics.domainStats.find((stat) => stat.domain === domain);

  if (run === undefined) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-9 w-32" />
        <Skeleton className="h-10 w-80" />
        <Skeleton className="h-64 rounded-xl" />
      </div>
    );
  }

  if (!run) {
    return (
      <EmptyState
        icon={History}
        title="批次不存在"
        description="它可能已经被删除，或者链接里的 ID 不对。"
        action={
          <Button variant="outline" onClick={() => router.push("/runs/")}>
            <ArrowLeft />
            返回历史批次
          </Button>
        }
      />
    );
  }

  if (!probes) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-9 w-32" />
        <Skeleton className="h-10 w-80" />
        <Skeleton className="h-64 rounded-xl" />
      </div>
    );
  }

  const handleDelete = async () => {
    try {
      await deleteRun(run.id);
      toast.success("批次已删除。");
      router.push("/runs/");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "删除失败。");
    } finally {
      setDeleting(false);
    }
  };

  const handleResume = async () => {
    if (!apiKey.key) {
      toast.error("请先在设置里填写 API Key。");
      router.push("/settings/");
      return;
    }
    setBusy(true);
    try {
      await resumeRun({
        runId: run.id,
        apiKey: apiKey.key,
        baseUrl: settings.customApiBase,
      });
      toast.success("未完成的探测已补跑。");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "继续运行失败。");
    } finally {
      setBusy(false);
    }
  };

  const handleRetry = async () => {
    if (!apiKey.key) {
      toast.error("请先在设置里填写 API Key。");
      router.push("/settings/");
      return;
    }
    setBusy(true);
    try {
      await retryFailedProbes({
        runId: run.id,
        apiKey: apiKey.key,
        baseUrl: settings.customApiBase,
      });
      toast.success("失败项已重试。");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "重试失败。");
    } finally {
      setBusy(false);
    }
  };

  const exportMarkdown = () => {
    downloadTextFile(
      `geo-probe-run-${run.id}.md`,
      runToMarkdown({ run, probes, prompts: effectivePrompts, metrics }),
    );
  };

  const changeTab = (value: string) => {
    onUpdateParams({ tab: value, prompt: null, probe: null, domain: null });
  };

  return (
    <div className="space-y-5">
      <Button variant="ghost" size="sm" onClick={() => router.push("/runs/")}>
        <ArrowLeft />
        历史批次
      </Button>

      <PageHeader
        eyebrow={project?.name ?? "批次详情"}
        title={
          <span className="inline-flex flex-wrap items-center gap-2">
            {run.name}
            <RunStatusBadge status={run.status} />
          </span>
        }
        description={
          <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span>{formatDateTime(run.startedAt)}</span>
            <span>·</span>
            <span>{run.config.model}</span>
            <span>·</span>
            <span>
              {metrics.successCount}/{run.plannedProbeCount} 次成功
            </span>
          </span>
        }
        actions={
          <>
            {run.status === "partial" && (
              <Button variant="outline" onClick={handleRetry} disabled={busy}>
                {busy ? <Loader2 className="animate-spin" /> : <RefreshCw />}
                重试失败项
              </Button>
            )}
            {run.status === "cancelled" && (
              <Button variant="outline" onClick={handleResume} disabled={busy}>
                {busy ? <Loader2 className="animate-spin" /> : <RefreshCw />}
                继续未完成
              </Button>
            )}
            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <Button variant="outline">
                    <Download />
                    导出
                  </Button>
                }
              />
              <DropdownMenuContent align="end" className="w-52">
                <DropdownMenuLabel>导出这个批次</DropdownMenuLabel>
                <DropdownMenuItem
                  onClick={() => downloadRunJson({ run, project, prompts: effectivePrompts, probes })}
                >
                  <FileJson className="size-3.5" />
                  JSON（完整数据）
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => downloadRunProbesCsv(run, probes)}>
                  <FileSpreadsheet className="size-3.5" />
                  探测明细 CSV
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => downloadRunSourcesCsv(run, probes)}>
                  <FileSpreadsheet className="size-3.5" />
                  来源明细 CSV
                </DropdownMenuItem>
                <DropdownMenuItem onClick={exportMarkdown}>
                  <FileText className="size-3.5" />
                  Markdown 报告
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <Button variant="ghost" size="icon">
                    <MoreHorizontal />
                  </Button>
                }
              />
              <DropdownMenuContent align="end">
                <DropdownMenuItem variant="destructive" onClick={() => setDeleting(true)}>
                  <Trash2 className="size-3.5" />
                  删除批次
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </>
        }
      />

      <div className="flex flex-wrap gap-2">
        <Badge variant="outline" className="font-normal">
          每条 {run.config.repeats} 次
        </Badge>
        <Badge variant="outline" className="font-normal">
          并发 {run.config.concurrency}
        </Badge>
        <Badge variant="outline" className="font-normal">
          最多 {run.config.maxUses} 次搜索
        </Badge>
        <Badge variant="outline" className="font-normal">
          {metrics.uniqueDomainCount} 个来源域名
        </Badge>
        {run.status === "running" && (
          <Badge variant="secondary" className="bg-chart-1/12 text-chart-1">
            实时更新
          </Badge>
        )}
      </div>

      <Tabs value={activeTab} onValueChange={changeTab}>
        <TabsList variant="line" className="max-w-full overflow-x-auto">
          <TabsTrigger value="overview">概览</TabsTrigger>
          <TabsTrigger value="prompts">Prompt</TabsTrigger>
          <TabsTrigger value="sources">来源</TabsTrigger>
          <TabsTrigger value="leaderboard">推荐榜</TabsTrigger>
          <TabsTrigger value="stability">稳定性</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="pt-4">
          <OverviewTab metrics={metrics} />
        </TabsContent>
        <TabsContent value="prompts" className="pt-4">
          <PromptsTab
            run={run}
            probes={probes}
            prompts={effectivePrompts}
            metrics={promptMetrics}
            promptId={promptId}
            onPromptChange={(id) => onUpdateParams({ prompt: id, tab: "prompts" })}
            onOpenProbe={(id) => onUpdateParams({ probe: id, domain: null })}
          />
        </TabsContent>
        <TabsContent value="sources" className="pt-4">
          <SourcesTab
            probes={probes}
            metrics={metrics}
            onOpenDomain={(value) => onUpdateParams({ domain: value, probe: null })}
          />
        </TabsContent>
        <TabsContent value="leaderboard" className="pt-4">
          <LeaderboardTab
            probes={probes}
            prompts={effectivePrompts}
            onOpenProbe={(id) => onUpdateParams({ probe: id, domain: null })}
          />
        </TabsContent>
        <TabsContent value="stability" className="pt-4">
          <StabilityTab
            run={run}
            probes={probes}
            prompts={effectivePrompts}
            metrics={metrics}
          />
        </TabsContent>
      </Tabs>

      <ProbeDrawer
        probe={activeProbe ?? null}
        prompt={effectivePrompts.find((prompt) => prompt.id === activeProbe?.promptId)}
        run={run}
        open={!!activeProbe}
        onOpenChange={(open) => {
          if (!open) onUpdateParams({ probe: null });
        }}
      />
      <DomainDrawer
        stat={activeDomain ?? null}
        prompts={effectivePrompts}
        open={!!activeDomain}
        onOpenChange={(open) => {
          if (!open) onUpdateParams({ domain: null });
        }}
      />

      <AlertDialog open={deleting} onOpenChange={setDeleting}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>删除这个批次？</AlertDialogTitle>
            <AlertDialogDescription>
              回答、来源和指标都会被删除，无法恢复。建议先导出 JSON 备份。
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
