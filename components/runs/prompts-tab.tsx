"use client";

import { useMemo, useState } from "react";
import { ListChecks } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { NativeSelect } from "@/components/ui/native-select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { EmptyState } from "@/components/empty-state";
import { PromptMetricsTable } from "@/components/prompt-metrics-table";
import { ProbeStatusBadge } from "@/components/status-badge";
import { TagList } from "@/components/tag-badge";
import type { Probe, Prompt, PromptMetrics, Run } from "@/lib/types";
import { formatDuration, formatNumber } from "@/lib/utils/format";

export function PromptsTab({
  run,
  probes,
  prompts,
  metrics,
  promptId,
  onPromptChange,
  onOpenProbe,
}: {
  run: Run;
  probes: Probe[];
  prompts: Prompt[];
  metrics: PromptMetrics[];
  promptId: string | null;
  onPromptChange: (promptId: string | null) => void;
  onOpenProbe: (probeId: string) => void;
}) {
  const [mentionFilter, setMentionFilter] = useState<"all" | "mentioned" | "not">("all");
  const brandId = run.aliasSnapshot.find((target) => target.kind === "brand")?.id ?? "brand";
  const promptMap = new Map(prompts.map((prompt) => [prompt.id, prompt]));

  const filtered = useMemo(() => {
    return probes.filter((probe) => {
      if (promptId && probe.promptId !== promptId) return false;
      const mentioned = probe.mentions.some((mention) => mention.targetId === brandId);
      if (mentionFilter === "mentioned" && !mentioned) return false;
      if (mentionFilter === "not" && mentioned) return false;
      return true;
    });
  }, [probes, promptId, mentionFilter, brandId]);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <div>
            <CardTitle className="text-base">Prompt 表现</CardTitle>
            <p className="mt-1 text-xs text-muted-foreground">
              点击一行筛选下方的探测明细
            </p>
          </div>
          {promptId && (
            <button
              className="text-xs text-muted-foreground hover:text-foreground"
              onClick={() => onPromptChange(null)}
            >
              清除筛选
            </button>
          )}
        </CardHeader>
        <CardContent className="px-0 pb-0">
          <PromptMetricsTable
            metrics={metrics}
            onSelectPrompt={(id) => onPromptChange(id === promptId ? null : id)}
            selectedPromptId={promptId}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-col gap-3 pb-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle className="text-base">探测明细</CardTitle>
            <p className="mt-1 text-xs text-muted-foreground">
              {filtered.length} 条{filtered.length !== probes.length ? ` / 共 ${probes.length} 条` : ""}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <NativeSelect
              value={mentionFilter}
              onChange={(event) =>
                setMentionFilter(event.target.value as "all" | "mentioned" | "not")
              }
              className="w-[140px]"
            >
              <option value="all">全部状态</option>
              <option value="mentioned">已提及品牌</option>
              <option value="not">未提及品牌</option>
            </NativeSelect>
          </div>
        </CardHeader>
        <CardContent className="px-0 pb-0">
          {filtered.length === 0 ? (
            <EmptyState
              icon={ListChecks}
              title="没有符合条件的探测"
              description="换一个筛选条件试试。"
              className="m-5"
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="min-w-[260px]">提示词</TableHead>
                  <TableHead>重复</TableHead>
                  <TableHead>状态</TableHead>
                  <TableHead>提及</TableHead>
                  <TableHead className="hidden text-right sm:table-cell">位次</TableHead>
                  <TableHead className="hidden text-right md:table-cell">来源</TableHead>
                  <TableHead className="hidden text-right md:table-cell">耗时</TableHead>
                  <TableHead className="hidden text-right lg:table-cell">Token</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((probe) => {
                  const mention = probe.mentions.find((item) => item.targetId === brandId);
                  const prompt = promptMap.get(probe.promptId);
                  return (
                    <TableRow
                      key={probe.id}
                      className="cursor-pointer"
                      onClick={() => onOpenProbe(probe.id)}
                    >
                      <TableCell className="max-w-[360px] whitespace-normal">
                        <div className="line-clamp-2 text-sm">{probe.promptText}</div>
                        {prompt && <TagList tags={prompt.tags} className="mt-1" />}
                        {probe.error && (
                          <div className="mt-1 line-clamp-1 text-[11px] text-destructive">
                            {probe.error.message}
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        #{probe.repeatIndex}
                      </TableCell>
                      <TableCell>
                        <ProbeStatusBadge status={probe.status} />
                      </TableCell>
                      <TableCell>
                        {mention ? (
                          <Badge variant="secondary" className="bg-primary/10 text-primary">
                            提及
                          </Badge>
                        ) : (
                          <span className="text-xs text-muted-foreground">未提及</span>
                        )}
                      </TableCell>
                      <TableCell className="hidden text-right text-xs tabular-nums sm:table-cell">
                        {mention ? (
                          <span>
                            {mention.order}
                            {mention.listPosition !== null && (
                              <span className="text-muted-foreground"> / 榜 {mention.listPosition}</span>
                            )}
                          </span>
                        ) : (
                          "—"
                        )}
                      </TableCell>
                      <TableCell className="hidden text-right text-xs tabular-nums md:table-cell">
                        {probe.sources.length}
                      </TableCell>
                      <TableCell className="hidden text-right text-xs tabular-nums md:table-cell">
                        {formatDuration(probe.latencyMs)}
                      </TableCell>
                      <TableCell className="hidden text-right text-xs tabular-nums lg:table-cell">
                        {formatNumber(probe.usage.inputTokens + probe.usage.outputTokens)}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
