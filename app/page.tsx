"use client";

import { useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  Globe2,
  ListChecks,
  Play,
  Quote,
  Sparkles,
  Trophy,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { PageHeader } from "@/components/page-header";
import { KpiCard } from "@/components/kpi-card";
import { InsightList } from "@/components/insight-list";
import { MethodologyNote } from "@/components/methodology-note";
import { Onboarding } from "@/components/layout/onboarding";
import { PromptMetricsTable } from "@/components/prompt-metrics-table";
import { ChartCard } from "@/components/charts/chart-card";
import { TagMentionChart } from "@/components/charts/tag-mention-chart";
import { ChannelDonut } from "@/components/charts/channel-donut";
import { TopDomainsChart } from "@/components/charts/top-domains-chart";
import { SovChart } from "@/components/charts/sov-chart";
import { computePromptMetricsList, computeRunMetrics, emptyRunMetrics } from "@/lib/analysis/metrics";
import { formatDateTime, formatPercent } from "@/lib/utils/format";
import { useAppStore } from "@/lib/hooks/use-app-store";
import { useProject, useProjects, usePrompts, useProbes, useRuns } from "@/lib/hooks/use-data";
import type { Prompt } from "@/lib/types";

function DashboardSkeleton() {
  return (
    <div className="space-y-5">
      <Skeleton className="h-10 w-72" />
      <Skeleton className="h-4 w-96" />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <Skeleton key={index} className="h-32 rounded-xl" />
        ))}
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        <Skeleton className="h-80 rounded-xl lg:col-span-2" />
        <Skeleton className="h-80 rounded-xl" />
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const router = useRouter();
  const projects = useProjects();
  const selectedProjectId = useAppStore((state) => state.selectedProjectId);
  const project = useProject(selectedProjectId);
  const prompts = usePrompts(project?.id);
  const runs = useRuns(project?.id);
  const latestRun = runs?.[0];
  const probes = useProbes(latestRun?.id);
  const previousProbes = useProbes(latestRun?.previousRunId);

  const brandId =
    latestRun?.aliasSnapshot.find((target) => target.kind === "brand")?.id ??
    project?.brand.id ??
    "brand";

  const effectivePrompts: Prompt[] = useMemo(() => {
    if (!latestRun) return [];
    return latestRun.promptSnapshot.map((prompt) => ({
      id: prompt.id,
      projectId: latestRun.projectId,
      text: prompt.text,
      tags: prompt.tags,
      enabled: true,
      createdAt: latestRun.createdAt,
      updatedAt: latestRun.createdAt,
    }));
  }, [latestRun]);

  const metrics = useMemo(() => {
    if (!latestRun || !probes) return emptyRunMetrics();
    return computeRunMetrics({
      run: latestRun,
      probes,
      prompts: effectivePrompts,
      previousProbes: previousProbes ?? [],
    });
  }, [latestRun, probes, effectivePrompts, previousProbes]);

  const promptMetrics = useMemo(() => {
    if (!effectivePrompts.length || !probes) return [];
    return computePromptMetricsList(effectivePrompts, probes, brandId).filter(
      (metric) => metric.probeCount > 0,
    );
  }, [effectivePrompts, probes, brandId]);

  if (projects !== undefined && projects.length === 0) {
    return <Onboarding />;
  }

  if (!project) {
    return <DashboardSkeleton />;
  }

  if (!runs || !prompts) {
    return <DashboardSkeleton />;
  }

  const brandSov = metrics.sov.find((item) => item.kind === "brand");
  const competitorMentions = metrics.sov
    .filter((item) => item.kind === "competitor")
    .reduce((sum, item) => sum + item.mentionCount, 0);

  if (runs.length === 0) {
    return (
      <div className="space-y-5">
        <PageHeader
          eyebrow="项目概览"
          title={project.name}
          description={`追踪「${project.brand.label}」在 AI 回答中的提及、竞品声量与检索来源。`}
          actions={
            <>
              <Button variant="outline" onClick={() => router.push("/prompts/")}>
                <ListChecks />
                管理提示词
              </Button>
              <Button onClick={() => router.push(prompts.length ? "/run/" : "/prompts/")}>
                <Play />
                {prompts.length ? "运行第一次探测" : "先添加提示词"}
              </Button>
            </>
          }
        />

        <Card className="overflow-hidden">
          <div className="relative">
            <div className="pointer-events-none absolute inset-0 bg-grid opacity-30 [mask-image:radial-gradient(ellipse_at_left,black,transparent_70%)]" />
            <CardContent className="relative grid gap-6 p-8 lg:grid-cols-[1.2fr_1fr] lg:p-10">
              <div className="space-y-4">
                <div className="inline-flex items-center gap-1.5 rounded-full border bg-background/70 px-3 py-1 text-xs text-muted-foreground">
                  <Sparkles className="size-3.5 text-chart-1" />
                  还没有批次
                </div>
                <h2 className="text-balance text-2xl font-semibold tracking-tight">
                  先跑一组真实问题，看看 AI 会不会提到你
                </h2>
                <p className="max-w-xl text-sm leading-6 text-muted-foreground">
                  建议准备 10–20 条提示词：通用词、品牌词、产品词、本地词和竞品词混合。每条默认跑 3 次，减少模型随机性。
                </p>
                <div className="flex flex-wrap gap-2">
                  <Button onClick={() => router.push(prompts.length ? "/run/" : "/prompts/")}>
                    <Play />
                    {prompts.length ? "运行探测" : "添加提示词"}
                  </Button>
                  <Button variant="outline" onClick={() => router.push("/prompts/")}>
                    批量导入
                    <ArrowRight />
                  </Button>
                </div>
              </div>
              <div className="grid gap-3">
                {[
                  { step: "01", title: "配置品牌", text: "品牌名、别名、官网域名、竞品，最多 5 个。" },
                  { step: "02", title: "批量提问", text: "DeepSeek 联网搜索 + 真实回答，默认每条跑 3 次。" },
                  { step: "03", title: "看缺口", text: "提及率、首位率、SoV、来源域名、官网可见度。" },
                ].map((item) => (
                  <div key={item.step} className="flex gap-3 rounded-xl border bg-card p-4">
                    <span className="font-mono text-xs text-muted-foreground">{item.step}</span>
                    <div>
                      <div className="text-sm font-medium">{item.title}</div>
                      <p className="mt-0.5 text-xs leading-5 text-muted-foreground">{item.text}</p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </div>
        </Card>

        <MethodologyNote />
      </div>
    );
  }

  if (!latestRun || !probes) {
    return <DashboardSkeleton />;
  }

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="项目概览"
        title={project.name}
        description={
          <span className="inline-flex flex-wrap items-center gap-x-2 gap-y-1">
            <span>追踪「{project.brand.label}」。</span>
            <span className="text-muted-foreground">最近批次：{latestRun.name}</span>
            <span className="text-muted-foreground">·</span>
            <span className="text-muted-foreground">{formatDateTime(latestRun.startedAt)}</span>
          </span>
        }
        actions={
          <>
            <Button variant="outline" onClick={() => router.push("/prompts/")}>
              <ListChecks />
              提示词
            </Button>
            <Button onClick={() => router.push("/run/")}>
              <Play />
              运行探测
            </Button>
          </>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          label="提及率"
          value={formatPercent(metrics.mentionRate)}
          hint={`${metrics.mentionCount}/${metrics.successCount} 次探测命中，共 ${metrics.webSearchRequests} 次搜索`}
          icon={Quote}
          tone="primary"
        />
        <KpiCard
          label="首位提及率"
          value={formatPercent(metrics.firstRate)}
          hint={`${metrics.firstCount}/${metrics.successCount} 次探测里，品牌是第一个被提到的追踪目标`}
          icon={Trophy}
        />
        <KpiCard
          label="声量份额"
          value={formatPercent(brandSov?.share ?? 0)}
          hint={`品牌 ${brandSov?.mentionCount ?? 0} 次 · 竞品合计 ${competitorMentions} 次`}
          icon={Users}
        />
        <KpiCard
          label="官网检索可见度"
          value={formatPercent(metrics.ownedDomain.rate)}
          hint={
            metrics.ownedDomain.present
              ? `官网出现在 ${metrics.ownedDomain.probeCount} 次探测中，最佳位次 ${metrics.ownedDomain.bestRank ?? "—"}`
              : "官网未进入检索来源，AI 看不到你的内容"
          }
          icon={Globe2}
          tone={metrics.ownedDomain.present ? "positive" : "warning"}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <ChartCard
          title="各标签提及率"
          description="通用词 vs 品牌词，缺口通常不在品牌词"
          className="lg:col-span-2"
        >
          <TagMentionChart data={metrics.tagMetrics} />
        </ChartCard>
        <InsightList insights={metrics.insights} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <ChartCard
          title="Top 来源域名"
          description="AI 检索时最常出现的网页来源"
          action={<span className="text-[11px] text-muted-foreground">按出现率</span>}
        >
          <TopDomainsChart data={metrics.domainStats} />
        </ChartCard>
        <ChartCard title="竞品声量份额" description="各追踪目标在探测中被提及的比例">
          <SovChart data={metrics.sov} />
        </ChartCard>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <ChartCard title="来源渠道" description="百科、社交、微信、新闻……" className="lg:col-span-1">
          <ChannelDonut data={metrics.channelDistribution} />
        </ChartCard>
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <div>
              <CardTitle className="text-base">Prompt 表现</CardTitle>
              <p className="mt-1 text-xs text-muted-foreground">
                按提示词看提及率、首位率和来源稳定性
              </p>
            </div>
            <Button variant="ghost" size="sm" onClick={() => router.push(`/runs/?run=${latestRun.id}`)}>
              查看批次
              <ArrowRight />
            </Button>
          </CardHeader>
          <CardContent className="px-0 pb-0">
            <PromptMetricsTable metrics={promptMetrics} runId={latestRun.id} />
          </CardContent>
        </Card>
      </div>

      <MethodologyNote compact />
    </div>
  );
}
