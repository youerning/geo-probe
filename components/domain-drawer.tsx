"use client";

import { ExternalLink, Link2, Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Separator } from "@/components/ui/separator";
import { ChannelBadge, OwnershipBadge } from "@/components/source-badges";
import { PROMPT_TAG_MAP } from "@/lib/config";
import type { DomainStat, Prompt } from "@/lib/types";
import { formatDateTime, formatPercent } from "@/lib/utils/format";

function Metric({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-lg border bg-muted/20 p-3">
      <div className="text-[10px] text-muted-foreground">{label}</div>
      <div className="mt-0.5 text-lg font-semibold tabular-nums">{value}</div>
    </div>
  );
}

export function DomainDrawer({
  stat,
  prompts,
  open,
  onOpenChange,
}: {
  stat: DomainStat | null;
  prompts: Prompt[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  if (!stat) return null;

  const promptMap = new Map(prompts.map((prompt) => [prompt.id, prompt]));

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto p-0 sm:max-w-xl">
        <SheetHeader className="border-b p-5 pr-10">
          <div className="flex flex-wrap items-center gap-2">
            <OwnershipBadge ownership={stat.ownership} />
            <ChannelBadge channel={stat.channel} />
            {stat.change === "new" && (
              <Badge variant="secondary" className="bg-emerald-500/12 text-emerald-600">
                本批次新增
              </Badge>
            )}
          </div>
          <SheetTitle className="text-left text-lg">{stat.platform || stat.domain}</SheetTitle>
          <SheetDescription className="break-all text-left">
            {stat.host && stat.host !== stat.domain ? `${stat.host} · ${stat.domain}` : stat.domain}
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-5 p-5">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <Metric label="出现率" value={formatPercent(stat.appearanceRate)} />
            <Metric label="平均位次" value={stat.avgRank.toFixed(1)} />
            <Metric label="最佳位次" value={stat.bestRank} />
            <Metric label="来源次数" value={stat.occurrenceCount} />
          </div>

          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
            <span>出现在 {stat.probeCount} 次探测中</span>
            <span>首次：{formatDateTime(stat.firstSeen)}</span>
            <span>最近：{formatDateTime(stat.lastSeen)}</span>
          </div>

          <Separator />

          <section className="space-y-2">
            <h3 className="text-sm font-medium">涉及的提示词</h3>
            <div className="space-y-1.5">
              {stat.promptIds.map((promptId) => {
                const prompt = promptMap.get(promptId);
                if (!prompt) return null;
                return (
                  <div key={promptId} className="rounded-lg border p-2.5 text-xs">
                    <div className="line-clamp-2">{prompt.text}</div>
                    <div className="mt-1 text-[10px] text-muted-foreground">
                      {prompt.tags.map((tag) => PROMPT_TAG_MAP[tag]?.label ?? tag).join(" / ") || "未分组"}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          <section className="space-y-2">
            <h3 className="flex items-center gap-1.5 text-sm font-medium">
              <Search className="size-4 text-chart-1" />
              出现的搜索词
            </h3>
            <div className="flex flex-wrap gap-1.5">
              {stat.queries.length ? (
                stat.queries.map((query) => (
                  <span key={query} className="rounded-full border bg-muted/30 px-2.5 py-1 text-[11px]">
                    {query}
                  </span>
                ))
              ) : (
                <span className="text-xs text-muted-foreground">—</span>
              )}
            </div>
          </section>

          <section className="space-y-2">
            <h3 className="flex items-center gap-1.5 text-sm font-medium">
              <ExternalLink className="size-4 text-chart-1" />
              样例页面
            </h3>
            <div className="divide-y rounded-lg border">
              {stat.sampleUrls.map((url, index) => (
                <a
                  key={url}
                  href={url}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="block p-3 text-xs hover:bg-muted/40"
                >
                  <div className="flex items-start gap-2">
                    <Link2 className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />
                    <div className="min-w-0">
                      <div className="line-clamp-2 font-medium">
                        {stat.sampleTitles[index] || url}
                      </div>
                      <div className="mt-0.5 break-all text-[10px] text-muted-foreground">{url}</div>
                    </div>
                  </div>
                </a>
              ))}
              {!stat.sampleUrls.length && (
                <div className="p-3 text-xs text-muted-foreground">没有样例页面。</div>
              )}
            </div>
          </section>

          <div className="rounded-lg border bg-muted/20 p-3 text-[11px] leading-5 text-muted-foreground">
            来源是搜索工具返回的网页，不代表模型逐句引用。出现率高说明这个域名在 AI 检索里比较活跃。
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
