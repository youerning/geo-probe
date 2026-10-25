"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  AlertTriangle,
  Clock,
  KeyRound,
  ListChecks,
  Loader2,
  Play,
  Square,
  Wallet,
  Zap,
} from "lucide-react";
import { toast } from "sonner";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { NativeSelect } from "@/components/ui/native-select";
import { NoProjectState } from "@/components/no-project-state";
import { PageHeader } from "@/components/page-header";
import { TagList } from "@/components/tag-badge";
import { EmptyState } from "@/components/empty-state";
import { estimateCost } from "@/lib/analysis/metrics";
import {
  DEFAULT_RUN_CONFIG,
  MODEL_OPTIONS,
} from "@/lib/config";
import { buildMessagesUrl } from "@/lib/providers/deepseek";
import { startRun, type RunProgress } from "@/lib/runner";
import { useApiKey } from "@/lib/hooks/use-api-key";
import { useAppSettings } from "@/lib/hooks/use-app-settings";
import { useAppStore } from "@/lib/hooks/use-app-store";
import { useProject, usePrompts, useProbes, useRuns } from "@/lib/hooks/use-data";
import type { RunConfig } from "@/lib/types";
import { formatCurrency, formatDuration } from "@/lib/utils/format";

const FALLBACK_AVG = { input: 13_000, output: 1_800, searches: 4, latency: 15_000 };

export default function RunPage() {
  const router = useRouter();
  const selectedProjectId = useAppStore((state) => state.selectedProjectId);
  const project = useProject(selectedProjectId);
  const prompts = usePrompts(project?.id);
  const runs = useRuns(project?.id);
  const latestRun = runs?.[0];
  const latestProbes = useProbes(latestRun?.id);
  const apiKey = useApiKey();
  const { settings } = useAppSettings();

  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const initializedProjectRef = useRef<string | null>(null);
  const [model, setModel] = useState(settings.defaultModel);
  const [repeats, setRepeats] = useState(settings.repeats);
  const [concurrency, setConcurrency] = useState(settings.concurrency);
  const [maxUses, setMaxUses] = useState(settings.maxUses);
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState<RunProgress | null>(null);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (!project || !prompts?.length) return;
    if (initializedProjectRef.current === project.id) return;
    initializedProjectRef.current = project.id;
    setSelectedIds(prompts.filter((prompt) => prompt.enabled).map((prompt) => prompt.id));
  }, [project, prompts]);

  useEffect(() => {
    setModel(settings.defaultModel);
    setRepeats(settings.repeats);
    setConcurrency(settings.concurrency);
    setMaxUses(settings.maxUses);
  }, [settings.defaultModel, settings.repeats, settings.concurrency, settings.maxUses]);

  useEffect(() => {
    if (!running) return;
    const handler = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [running]);

  const selectedPrompts = useMemo(
    () => (prompts ?? []).filter((prompt) => selectedIds.includes(prompt.id)),
    [prompts, selectedIds],
  );

  const averages = useMemo(() => {
    const successes = (latestProbes ?? []).filter((probe) => probe.status === "success");
    if (!successes.length) return FALLBACK_AVG;
    return {
      input: successes.reduce((sum, probe) => sum + probe.usage.inputTokens, 0) / successes.length,
      output:
        successes.reduce((sum, probe) => sum + probe.usage.outputTokens, 0) / successes.length,
      searches:
        successes.reduce((sum, probe) => sum + probe.usage.webSearchRequests, 0) /
        successes.length,
      latency:
        successes.reduce((sum, probe) => sum + probe.latencyMs, 0) / successes.length,
    };
  }, [latestProbes]);

  const proxyMode = Boolean(settings.customApiBase.trim());
  const canRun = Boolean(apiKey.key) || proxyMode;
  const planned = selectedPrompts.length * repeats;
  const estimatedCost = estimateCost(
    averages.input * planned,
    averages.output * planned,
    averages.searches * planned,
    model,
  );
  const estimatedSeconds =
    planned && averages.latency ? (averages.latency * planned) / Math.max(1, concurrency) / 1000 : 0;

  if (!project) {
    return <NoProjectState />;
  }

  if (!prompts) {
    return (
      <div className="flex items-center gap-2 py-20 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" />
        加载提示词…
      </div>
    );
  }

  if (!prompts.length) {
    return (
      <div className="space-y-5">
        <PageHeader eyebrow="运行探测" title="先准备提示词" description="没有提示词就没法批量提问。" />
        <EmptyState
          icon={ListChecks}
          title="还没有提示词"
          description="先添加 10–20 条真实用户会问 AI 的问题，再回来运行。"
          action={
            <Button onClick={() => router.push("/prompts/")}>
              <ListChecks />
              去添加提示词
            </Button>
          }
        />
      </div>
    );
  }

  const togglePrompt = (id: string) => {
    setSelectedIds((current) =>
      current.includes(id) ? current.filter((item) => item !== id) : [...current, id],
    );
  };

  const handleStart = async () => {
    if (!selectedPrompts.length) {
      toast.error("至少选择一条提示词。");
      return;
    }
    if (!apiKey.key && !proxyMode) {
      toast.error("请先在设置里填写 DeepSeek API Key，或配置代理地址。");
      router.push("/settings/");
      return;
    }

    const config: RunConfig = {
      ...DEFAULT_RUN_CONFIG,
      model,
      maxTokens: settings.maxTokens,
      maxUses,
      repeats,
      concurrency,
      endpoint: buildMessagesUrl(settings.customApiBase),
    };

    setError(null);
    setRunning(true);
    setProgress({
      runId: "",
      total: selectedPrompts.length * repeats,
      completed: 0,
      success: 0,
      error: 0,
    });

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const { run } = await startRun({
        project,
        prompts: selectedPrompts,
        config,
        apiKey: apiKey.key,
        baseUrl: settings.customApiBase,
        repeats,
        concurrency,
        signal: controller.signal,
        onProgress: setProgress,
      });
      toast.success("批次已完成。");
      router.push(`/runs/?run=${run.id}`);
    } catch (caught) {
      if (controller.signal.aborted) {
        toast.message("批次已取消，已完成的结果已保存。");
      } else {
        const message = caught instanceof Error ? caught.message : String(caught);
        setError(message);
        toast.error(message);
      }
    } finally {
      setRunning(false);
      abortRef.current = null;
    }
  };

  const handleCancel = () => {
    abortRef.current?.abort();
  };

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="运行探测"
        title="批量向 AI 提问"
        description={`项目「${project.name}」· 追踪 ${[project.brand, ...project.competitors].length} 个目标（品牌 + ${project.competitors.length} 个竞品）。`}
        actions={
          running ? (
            <Button variant="outline" onClick={handleCancel}>
              <Square />
              取消
            </Button>
          ) : (
            <Button onClick={handleStart} disabled={!selectedPrompts.length || !canRun}>
              <Play />
              开始运行
            </Button>
          )
        }
      />

      {!canRun && apiKey.loaded && (
        <Alert>
          <KeyRound />
          <AlertTitle>还没有 DeepSeek API Key</AlertTitle>
          <AlertDescription>
            真实探测需要你的 Key，或在设置里配置一个代理地址。
            <Link href="/settings/" className="underline underline-offset-2">去设置</Link>
            。示例数据和历史批次不需要 Key。
          </AlertDescription>
        </Alert>
      )}

      {error && (
        <Alert variant="destructive">
          <AlertTriangle />
          <AlertTitle>运行失败</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between gap-3 pb-3">
            <div>
              <CardTitle className="text-base">选择提示词</CardTitle>
              <p className="mt-1 text-xs text-muted-foreground">
                已选 {selectedPrompts.length} / {prompts.length} 条
              </p>
            </div>
            <div className="flex gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSelectedIds(prompts.map((prompt) => prompt.id))}
                disabled={running}
              >
                全选
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSelectedIds([])}
                disabled={running}
              >
                清空
              </Button>
            </div>
          </CardHeader>
          <CardContent className="max-h-[520px] space-y-1 overflow-y-auto px-2 pb-3 scrollbar-thin">
            {prompts.map((prompt) => (
              <label
                key={prompt.id}
                className="flex cursor-pointer items-start gap-3 rounded-lg px-2.5 py-2.5 transition-colors hover:bg-muted/50"
              >
                <Checkbox
                  checked={selectedIds.includes(prompt.id)}
                  onCheckedChange={() => togglePrompt(prompt.id)}
                  className="mt-0.5"
                  disabled={running}
                />
                <span className="min-w-0 flex-1 space-y-1">
                  <span className="block text-sm leading-6">{prompt.text}</span>
                  <TagList tags={prompt.tags} />
                </span>
                {!prompt.enabled && (
                  <span className="text-[10px] text-muted-foreground">已停用</span>
                )}
              </label>
            ))}
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">运行参数</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="model">模型</Label>
                <NativeSelect
                  id="model"
                  value={model}
                  onChange={(event) => setModel(event.target.value)}
                  disabled={running}
                >
                  {MODEL_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </NativeSelect>
                <p className="text-[11px] leading-4 text-muted-foreground">
                  {MODEL_OPTIONS.find((option) => option.value === model)?.description}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="repeats">每条重复</Label>
                  <NativeSelect
                    id="repeats"
                    value={repeats}
                    onChange={(event) => setRepeats(Number(event.target.value))}
                    disabled={running}
                  >
                    {[1, 2, 3, 4, 5].map((value) => (
                      <option key={value} value={value}>
                        {value} 次
                      </option>
                    ))}
                  </NativeSelect>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="concurrency">并发</Label>
                  <NativeSelect
                    id="concurrency"
                    value={concurrency}
                    onChange={(event) => setConcurrency(Number(event.target.value))}
                    disabled={running}
                  >
                    {[1, 2, 3].map((value) => (
                      <option key={value} value={value}>
                        {value}
                      </option>
                    ))}
                  </NativeSelect>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="max-uses">每次最多搜索</Label>
                <NativeSelect
                  id="max-uses"
                  value={maxUses}
                  onChange={(event) => setMaxUses(Number(event.target.value))}
                  disabled={running}
                >
                  {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((value) => (
                    <option key={value} value={value}>
                      {value} 次
                    </option>
                  ))}
                </NativeSelect>
                <p className="text-[11px] text-muted-foreground">
                  搜索次数越多，输入 token 和费用越高。
                </p>
              </div>

              <div className="space-y-2 rounded-lg border bg-muted/30 p-3 text-xs">
                <div className="flex items-center justify-between">
                  <span className="inline-flex items-center gap-1.5 text-muted-foreground">
                    <Zap className="size-3.5" />
                    探测次数
                  </span>
                  <span className="font-medium tabular-nums">{planned}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="inline-flex items-center gap-1.5 text-muted-foreground">
                    <Wallet className="size-3.5" />
                    预计费用
                  </span>
                  <span className="font-medium tabular-nums">{formatCurrency(estimatedCost)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="inline-flex items-center gap-1.5 text-muted-foreground">
                    <Clock className="size-3.5" />
                    预计耗时
                  </span>
                  <span className="font-medium tabular-nums">
                    {estimatedSeconds ? formatDuration(estimatedSeconds * 1000) : "—"}
                  </span>
                </div>
                <p className="pt-1 text-[10px] leading-4 text-muted-foreground">
                  按上次成功批次的平均 token / 耗时估算，实际以 DeepSeek 账单为准。
                </p>
              </div>

              <div className="flex items-center justify-between rounded-lg border p-3 text-xs">
                <span className="inline-flex items-center gap-1.5 text-muted-foreground">
                  <KeyRound className="size-3.5" />
                  API Key
                </span>
                <span className={canRun ? "text-emerald-600 dark:text-emerald-400" : "text-amber-600"}>
                  {apiKey.key
                    ? apiKey.source === "session"
                      ? "仅本次会话"
                      : "已保存"
                    : proxyMode
                      ? "代理模式"
                      : "未设置"}
                </span>
              </div>

              {running ? (
                <Button variant="outline" className="w-full" onClick={handleCancel}>
                  <Square />
                  取消运行
                </Button>
              ) : (
                <Button
                  className="w-full"
                  onClick={handleStart}
                  disabled={!selectedPrompts.length || !canRun}
                >
                  <Play />
                  开始运行
                </Button>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {(running || progress) && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              {running ? <Loader2 className="size-4 animate-spin" /> : <Zap className="size-4" />}
              {running ? "正在探测" : progress ? "运行进度" : ""}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Progress
              value={
                progress && progress.total
                  ? Math.round((progress.completed / progress.total) * 100)
                  : 0
              }
            />
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
              <span>
                {progress?.completed ?? 0}/{progress?.total ?? planned}
              </span>
              <span className="text-emerald-600 dark:text-emerald-400">
                成功 {progress?.success ?? 0}
              </span>
              <span className="text-destructive">失败 {progress?.error ?? 0}</span>
              {progress?.lastProbe && (
                <span className="truncate">
                  最近：重复 #{progress.lastProbe.repeatIndex} · {progress.lastProbe.status}
                  {progress.lastProbe.message ? ` · ${progress.lastProbe.message}` : ""}
                </span>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      <p className="text-[11px] leading-5 text-muted-foreground">
        提示：关闭页面会中断浏览器里的运行，但已完成的结果会保存在本地。建议一次不要选太多提示词，先跑 10–20 条。
      </p>
    </div>
  );
}
