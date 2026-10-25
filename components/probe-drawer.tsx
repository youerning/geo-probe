"use client";

import { Copy, ExternalLink, ListOrdered, Search, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Separator } from "@/components/ui/separator";
import { ProbeStatusBadge } from "@/components/status-badge";
import { ProseAnswer } from "@/components/prose-answer";
import { ChannelBadge, OwnershipBadge } from "@/components/source-badges";
import { PROMPT_TAG_MAP } from "@/lib/config";
import type { Probe, Prompt, Run } from "@/lib/types";
import { formatDateTime, formatDuration, formatNumber } from "@/lib/utils/format";

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function HighlightedContext({ text, alias }: { text: string; alias: string }) {
  if (!alias) return <>{text}</>;
  const parts = text.split(new RegExp(`(${escapeRegExp(alias)})`, "gi"));
  return (
    <>
      {parts.map((part, index) =>
        part.toLowerCase() === alias.toLowerCase() ? <mark key={index}>{part}</mark> : part,
      )}
    </>
  );
}

function MetaItem({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="truncate text-xs font-medium">{value}</div>
    </div>
  );
}

export function ProbeDrawer({
  probe,
  prompt,
  run,
  open,
  onOpenChange,
}: {
  probe: Probe | null;
  prompt?: Prompt;
  run?: Run;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  if (!probe) return null;

  const targetMap = new Map(run?.aliasSnapshot.map((target) => [target.id, target]) ?? []);
  const copyAnswer = async () => {
    await navigator.clipboard.writeText(probe.answer);
    toast.success("回答已复制。");
  };

  const bestSources = [...probe.sources].sort((a, b) => {
    const aRank = Math.min(...a.occurrences.map((occurrence) => occurrence.rank));
    const bRank = Math.min(...b.occurrences.map((occurrence) => occurrence.rank));
    return aRank - bRank;
  });

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto p-0 sm:max-w-3xl">
        <SheetHeader className="border-b p-5 pr-10">
          <div className="flex flex-wrap items-center gap-2">
            <ProbeStatusBadge status={probe.status} />
            <Badge variant="outline" className="font-normal">
              第 {probe.repeatIndex} 次
            </Badge>
            {probe.stopReason === "max_tokens" && (
              <Badge variant="secondary" className="bg-amber-500/12 text-amber-600">
                可能被截断
              </Badge>
            )}
          </div>
          <SheetTitle className="line-clamp-3 text-left text-base leading-6">
            {probe.promptText}
          </SheetTitle>
          <SheetDescription className="text-left">
            {formatDateTime(probe.startedAt)} ·{" "}
            {(prompt?.tags ?? probe.promptTags)
              .map((tag) => PROMPT_TAG_MAP[tag]?.label ?? tag)
              .join(" / ") || "未分组"}
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-5 p-5">
          <div className="grid grid-cols-2 gap-3 rounded-xl border bg-muted/20 p-4">
            <MetaItem label="模型" value={probe.model} />
            <MetaItem label="耗时" value={formatDuration(probe.latencyMs)} />
            <MetaItem label="Token" value={formatNumber(probe.usage.inputTokens + probe.usage.outputTokens)} />
            <MetaItem label="搜索" value={`${probe.usage.webSearchRequests} 次`} />
            <MetaItem label="输入 / 输出" value={`${formatNumber(probe.usage.inputTokens)} / ${formatNumber(probe.usage.outputTokens)}`} />
            <MetaItem label="请求 ID" value={probe.requestId ?? "—"} />
            <MetaItem label="尝试次数" value={probe.attempts} />
            <MetaItem label="回答长度" value={`${formatNumber(probe.answerChars)} 字`} />
          </div>

          {probe.error && (
            <Alert variant="destructive">
              <AlertTitle>这次探测没有成功</AlertTitle>
              <AlertDescription>{probe.error.message}</AlertDescription>
            </Alert>
          )}

          <section className="space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="flex items-center gap-1.5 text-sm font-medium">
                <Sparkles className="size-4 text-chart-1" />
                提及
              </h3>
              <span className="text-[11px] text-muted-foreground">
                {probe.mentions.length} 个追踪目标出现
              </span>
            </div>
            {probe.mentions.length === 0 ? (
              <p className="rounded-lg border border-dashed p-3 text-xs text-muted-foreground">
                回答里没有出现品牌或竞品的任何别名。
              </p>
            ) : (
              <div className="space-y-2">
                {probe.mentions.map((mention) => {
                  const target = targetMap.get(mention.targetId);
                  return (
                    <div key={mention.targetId} className="rounded-lg border p-3">
                      <div className="mb-1.5 flex flex-wrap items-center gap-2">
                        <Badge variant={target?.kind === "brand" ? "default" : "secondary"}>
                          {mention.targetLabel}
                        </Badge>
                        <span className="text-[11px] text-muted-foreground">
                          别名：{mention.matchedAliases.join(" / ")}
                        </span>
                        <span className="text-[11px] text-muted-foreground">
                          第 {mention.order} 个被提到 · 出现 {mention.count} 次
                        </span>
                        {mention.listPosition !== null && (
                          <Badge variant="outline" className="font-normal">
                            榜单第 {mention.listPosition} 位
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs leading-6 text-muted-foreground">
                        <HighlightedContext text={mention.context} alias={mention.alias} />
                      </p>
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          <Separator />

          <section className="space-y-2">
            <h3 className="flex items-center gap-1.5 text-sm font-medium">
              <Search className="size-4 text-chart-1" />
              AI 搜索词
            </h3>
            {probe.queries.length === 0 ? (
              <p className="text-xs text-muted-foreground">这次回答没有触发联网搜索。</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {probe.queries.map((query) => (
                  <span
                    key={query.id}
                    className="inline-flex max-w-full items-center gap-1.5 rounded-full border bg-muted/30 px-2.5 py-1 text-[11px]"
                  >
                    <span className="truncate">{query.query}</span>
                    <span className="text-muted-foreground">{query.resultCount} 条</span>
                    {query.error && <span className="text-destructive">失败</span>}
                  </span>
                ))}
              </div>
            )}
          </section>

          <section className="space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="flex items-center gap-1.5 text-sm font-medium">
                <ExternalLink className="size-4 text-chart-1" />
                检索来源
              </h3>
              <span className="text-[11px] text-muted-foreground">
                {probe.sources.length} 个网页 · 不代表逐句引用
              </span>
            </div>
            {probe.sources.length === 0 ? (
              <p className="text-xs text-muted-foreground">没有返回来源。</p>
            ) : (
              <div className="divide-y rounded-lg border">
                {bestSources.map((source) => {
                  const bestRank = Math.min(...source.occurrences.map((item) => item.rank));
                  return (
                    <div key={source.id} className="space-y-1.5 p-3">
                      <div className="flex items-start gap-2">
                        <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded bg-muted text-[10px] tabular-nums">
                          {bestRank}
                        </span>
                        <div className="min-w-0 flex-1">
                          <a
                            href={source.url}
                            target="_blank"
                            rel="noreferrer noopener"
                            className="line-clamp-2 text-xs font-medium hover:text-primary"
                          >
                            {source.title || source.url}
                          </a>
                          <div className="mt-1 flex flex-wrap items-center gap-1.5">
                            <span className="text-[10px] text-muted-foreground">{source.platform}</span>
                            <OwnershipBadge ownership={source.ownership} className="text-[10px]" />
                            <ChannelBadge channel={source.channel} className="text-[10px]" />
                          </div>
                        </div>
                      </div>
                      {source.occurrences.length > 1 && (
                        <div className="pl-7 text-[10px] text-muted-foreground">
                          {source.occurrences.map((occurrence) => (
                            <div key={`${occurrence.queryId}-${occurrence.rank}`} className="truncate">
                              {occurrence.query} · 第 {occurrence.rank} 位
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          {probe.answerLinks.length > 0 && (
            <section className="space-y-2">
              <h3 className="text-sm font-medium">回答中的链接</h3>
              <div className="space-y-1.5">
                {probe.answerLinks.map((link) => (
                  <a
                    key={link.canonicalUrl}
                    href={link.url}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="flex items-center gap-2 rounded-lg border p-2 text-xs hover:bg-muted/40"
                  >
                    <span className="min-w-0 flex-1 truncate">{link.url}</span>
                    <Badge variant={link.inSources ? "secondary" : "outline"} className="shrink-0 font-normal">
                      {link.inSources ? "在检索来源中" : "不在来源中"}
                    </Badge>
                  </a>
                ))}
              </div>
            </section>
          )}

          {probe.listItems.length > 1 && (
            <section className="space-y-2">
              <h3 className="flex items-center gap-1.5 text-sm font-medium">
                <ListOrdered className="size-4 text-chart-1" />
                解析出的榜单
              </h3>
              <div className="divide-y rounded-lg border">
                {probe.listItems.map((item) => (
                  <div key={`${item.index}-${item.title}`} className="flex items-center gap-2 p-2 text-xs">
                    <span className="w-5 shrink-0 text-right font-mono text-[10px] text-muted-foreground">
                      {item.index}
                    </span>
                    <span className="min-w-0 flex-1 truncate">{item.title}</span>
                    {item.matchedLabel ? (
                      <Badge variant="secondary" className="shrink-0 font-normal">
                        {item.matchedLabel}
                      </Badge>
                    ) : (
                      <span className="shrink-0 text-[10px] text-muted-foreground">未追踪</span>
                    )}
                  </div>
                ))}
              </div>
              <p className="text-[10px] text-muted-foreground">自动解析，仅供参考。</p>
            </section>
          )}

          {probe.otherEntities.length > 0 && (
            <section className="space-y-2">
              <h3 className="text-sm font-medium">其他被提到的公司</h3>
              <div className="flex flex-wrap gap-1.5">
                {probe.otherEntities.map((entity) => (
                  <Badge key={entity} variant="outline" className="font-normal">
                    {entity}
                  </Badge>
                ))}
              </div>
            </section>
          )}

          <Separator />

          <section className="space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-medium">回答全文</h3>
              <Button variant="ghost" size="sm" onClick={copyAnswer}>
                <Copy />
                复制
              </Button>
            </div>
            {probe.answer ? (
              <ProseAnswer>{probe.answer}</ProseAnswer>
            ) : (
              <p className="text-xs text-muted-foreground">没有最终回答。</p>
            )}
          </section>

          <div className="rounded-lg border bg-muted/20 p-3 text-[11px] leading-5 text-muted-foreground">
            “提及”按别名匹配；“检索来源”是搜索工具返回的网页，不代表模型逐句引用。来源出现率不等于引用率。
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
