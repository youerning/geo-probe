"use client";

import { Activity, Info } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { TagList } from "@/components/tag-badge";
import { computePromptMetricsList } from "@/lib/analysis/metrics";
import type { Probe, Prompt, Run, RunMetrics } from "@/lib/types";
import { formatPercent } from "@/lib/utils/format";

export function StabilityTab({
  run,
  probes,
  prompts,
  metrics,
}: {
  run: Run;
  probes: Probe[];
  prompts: Prompt[];
  metrics: RunMetrics;
}) {
  const brandId = run.aliasSnapshot.find((target) => target.kind === "brand")?.id ?? "brand";
  const promptMetrics = computePromptMetricsList(prompts, probes, brandId).filter(
    (metric) => metric.probeCount > 0,
  );

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <Activity className="size-4 text-chart-1" />
            整体稳定性
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="rounded-xl border p-4">
            <div className="text-xs text-muted-foreground">提及稳定性</div>
            <div className="mt-1 text-2xl font-semibold tabular-nums">
              {formatPercent(metrics.successCount ? metrics.mentionCount / metrics.successCount : 0)}
            </div>
            <p className="mt-1 text-[11px] leading-5 text-muted-foreground">
              {metrics.mentionCount}/{metrics.successCount} 次探测提到了品牌。
            </p>
          </div>
          <div className="rounded-xl border p-4">
            <div className="text-xs text-muted-foreground">来源稳定性</div>
            <div className="mt-1 text-2xl font-semibold tabular-nums">
              {metrics.sourceStability === null ? "—" : formatPercent(metrics.sourceStability)}
            </div>
            <p className="mt-1 text-[11px] leading-5 text-muted-foreground">
              同一 prompt 多次搜索的域名集合重合度（Jaccard 平均）。
            </p>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        {promptMetrics.map((metric) => (
          <Card key={metric.promptId}>
            <CardHeader className="space-y-2 pb-3">
              <div className="line-clamp-2 text-sm font-medium">{metric.text}</div>
              <TagList tags={metric.tags} />
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">提及稳定性</span>
                  <span className="tabular-nums">{formatPercent(metric.mentionRate)}</span>
                </div>
                <Progress value={metric.mentionRate * 100} />
                <div className="text-[10px] text-muted-foreground">
                  {metric.mentionCount}/{metric.successCount} 次命中
                  {metric.avgOrder && ` · 平均位次 ${metric.avgOrder.toFixed(1)}`}
                  {metric.avgListPosition && ` · 榜单平均 ${metric.avgListPosition.toFixed(1)}`}
                </div>
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">来源稳定性</span>
                  <span className="tabular-nums">
                    {metric.sourceStability === null ? "样本不足" : formatPercent(metric.sourceStability)}
                  </span>
                </div>
                <Progress value={(metric.sourceStability ?? 0) * 100} />
                <div className="text-[10px] text-muted-foreground">
                  {metric.successCount < 2
                    ? "至少需要 2 次成功探测"
                    : metric.sourceStability !== null && metric.sourceStability < 0.4
                      ? "重合度偏低，单次结果参考价值有限"
                      : "重合度尚可"}
                </div>
              </div>

              <div className="flex flex-wrap gap-1.5">
                {metric.topDomains.map((domain) => (
                  <Badge key={domain} variant="outline" className="font-normal text-muted-foreground">
                    {domain}
                  </Badge>
                ))}
                {!metric.topDomains.length && (
                  <span className="text-[11px] text-muted-foreground">没有来源域名</span>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="flex gap-2.5 rounded-xl border bg-muted/30 p-4 text-xs leading-5 text-muted-foreground">
        <Info className="mt-0.5 size-4 shrink-0" />
        <p>
          生成式搜索本身不稳定：同一问题反复问，AI 的答案和来源都可能变化。建议把“提及率”看作一段时间内的概率，
          而不是一次问答的确定结果。默认每条 prompt 跑 3 次，就是为了看波动。
        </p>
      </div>
    </div>
  );
}
