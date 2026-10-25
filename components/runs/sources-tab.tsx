"use client";

import { useMemo, useState } from "react";
import { Globe2, Search, ShieldCheck, Waves } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
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
import { KpiCard } from "@/components/kpi-card";
import { ChannelBadge, OwnershipBadge } from "@/components/source-badges";
import {
  SOURCE_CHANNEL_LABELS,
  SOURCE_OWNERSHIP_LABELS,
} from "@/lib/config";
import type { DomainStat, Probe, RunMetrics, SourceChannel, SourceOwnership } from "@/lib/types";
import { formatPercent } from "@/lib/utils/format";

export function SourcesTab({
  probes,
  metrics,
  onOpenDomain,
}: {
  probes: Probe[];
  metrics: RunMetrics;
  onOpenDomain: (domain: string) => void;
}) {
  const [search, setSearch] = useState("");
  const [ownership, setOwnership] = useState<"all" | SourceOwnership>("all");
  const [channel, setChannel] = useState<"all" | SourceChannel>("all");
  const [sort, setSort] = useState<"appearance" | "rank" | "occurrences">("appearance");

  const queries = useMemo(() => {
    const map = new Map<string, number>();
    for (const probe of probes) {
      for (const source of probe.sources) {
        for (const occurrence of source.occurrences) {
          if (!occurrence.query) continue;
          map.set(occurrence.query, (map.get(occurrence.query) ?? 0) + 1);
        }
      }
    }
    return Array.from(map.entries())
      .map(([query, count]) => ({ query, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 14);
  }, [probes]);

  const filtered = useMemo(() => {
    const list = metrics.domainStats.filter((stat) => {
      if (search) {
        const haystack = `${stat.domain} ${stat.platform}`.toLowerCase();
        if (!haystack.includes(search.toLowerCase())) return false;
      }
      if (ownership !== "all" && stat.ownership !== ownership) return false;
      if (channel !== "all" && stat.channel !== channel) return false;
      return true;
    });

    return [...list].sort((a, b) => {
      if (sort === "rank") return a.avgRank - b.avgRank;
      if (sort === "occurrences") return b.occurrenceCount - a.occurrenceCount;
      return b.appearanceRate - a.appearanceRate;
    });
  }, [metrics.domainStats, search, ownership, channel, sort]);

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          label="唯一来源域名"
          value={metrics.uniqueDomainCount}
          hint={`${metrics.webSearchRequests} 次搜索，${metrics.successCount} 次成功探测`}
          icon={Globe2}
        />
        <KpiCard
          label="官网检索可见度"
          value={formatPercent(metrics.ownedDomain.rate)}
          hint={
            metrics.ownedDomain.present
              ? `最佳位次 ${metrics.ownedDomain.bestRank ?? "—"}`
              : "自有域名未进入检索来源"
          }
          icon={ShieldCheck}
          tone={metrics.ownedDomain.present ? "positive" : "warning"}
        />
        <KpiCard
          label="来源稳定性"
          value={metrics.sourceStability === null ? "—" : formatPercent(metrics.sourceStability)}
          hint="同一 prompt 多次搜索的域名重合度（Jaccard 平均）"
          icon={Waves}
          tone={
            metrics.sourceStability !== null && metrics.sourceStability < 0.4
              ? "warning"
              : "default"
          }
        />
        <KpiCard
          label="来源类型"
          value={metrics.channelDistribution.length}
          hint="百科、社交、微信、新闻、企业信息等"
          icon={Search}
        />
      </div>

      {queries.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">AI 搜索词</CardTitle>
            <p className="mt-1 text-xs text-muted-foreground">
              模型会把你的问题改写成这些搜索词。数字是来源命中次数。
            </p>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            {queries.map((query) => (
              <span
                key={query.query}
                className="inline-flex max-w-full items-center gap-1.5 rounded-full border bg-muted/30 px-2.5 py-1 text-[11px]"
              >
                <span className="truncate">{query.query}</span>
                <span className="text-muted-foreground">{query.count}</span>
              </span>
            ))}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="space-y-3 pb-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle className="text-base">来源域名</CardTitle>
              <p className="mt-1 text-xs text-muted-foreground">
                {filtered.length} / {metrics.domainStats.length} 个域名 · 点击查看详情
              </p>
            </div>
            <div className="relative w-full sm:w-56">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="搜索域名或平台"
                className="h-8 pl-8 text-xs"
              />
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <NativeSelect
              value={ownership}
              onChange={(event) => setOwnership(event.target.value as "all" | SourceOwnership)}
              className="w-[130px]"
            >
              <option value="all">全部归属</option>
              {Object.entries(SOURCE_OWNERSHIP_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </NativeSelect>
            <NativeSelect
              value={channel}
              onChange={(event) => setChannel(event.target.value as "all" | SourceChannel)}
              className="w-[150px]"
            >
              <option value="all">全部渠道</option>
              {Object.entries(SOURCE_CHANNEL_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </NativeSelect>
            <NativeSelect
              value={sort}
              onChange={(event) =>
                setSort(event.target.value as "appearance" | "rank" | "occurrences")
              }
              className="w-[140px]"
            >
              <option value="appearance">按出现率</option>
              <option value="rank">按平均位次</option>
              <option value="occurrences">按来源次数</option>
            </NativeSelect>
          </div>
        </CardHeader>
        <CardContent className="px-0 pb-0">
          {filtered.length === 0 ? (
            <EmptyState
              icon={Globe2}
              title="没有符合条件的来源"
              description="换一个筛选条件，或者先跑一个批次。"
              className="m-5"
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="min-w-[240px]">平台 / 域名</TableHead>
                  <TableHead>归属</TableHead>
                  <TableHead className="hidden sm:table-cell">渠道</TableHead>
                  <TableHead>出现率</TableHead>
                  <TableHead className="hidden text-right sm:table-cell">平均位次</TableHead>
                  <TableHead className="hidden text-right md:table-cell">来源次数</TableHead>
                  <TableHead className="hidden text-right md:table-cell">探测数</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((stat: DomainStat) => (
                  <TableRow
                    key={stat.domain}
                    className="cursor-pointer"
                    onClick={() => onOpenDomain(stat.domain)}
                  >
                    <TableCell className="whitespace-normal">
                      <div className="flex items-center gap-2">
                        <span className="line-clamp-1 text-sm font-medium">
                          {stat.platform || stat.domain}
                        </span>
                        {stat.change === "new" && (
                          <Badge variant="secondary" className="bg-emerald-500/12 text-emerald-600">
                            新
                          </Badge>
                        )}
                      </div>
                      <div className="line-clamp-1 text-[11px] text-muted-foreground">
                        {stat.host && stat.host !== stat.domain ? `${stat.host} · ${stat.domain}` : stat.domain}
                      </div>
                    </TableCell>
                    <TableCell>
                      <OwnershipBadge ownership={stat.ownership} />
                    </TableCell>
                    <TableCell className="hidden sm:table-cell">
                      <ChannelBadge channel={stat.channel} />
                    </TableCell>
                    <TableCell>
                      <div className="flex min-w-[86px] items-center gap-2">
                        <span className="w-11 text-right text-xs tabular-nums">
                          {formatPercent(stat.appearanceRate)}
                        </span>
                        <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                          <span
                            className="block h-full rounded-full bg-chart-2"
                            style={{ width: `${Math.min(100, stat.appearanceRate * 100)}%` }}
                          />
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="hidden text-right text-xs tabular-nums sm:table-cell">
                      {stat.avgRank.toFixed(1)}
                    </TableCell>
                    <TableCell className="hidden text-right text-xs tabular-nums md:table-cell">
                      {stat.occurrenceCount}
                    </TableCell>
                    <TableCell className="hidden text-right text-xs tabular-nums md:table-cell">
                      {stat.probeCount}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {(metrics.newDomains.length > 0 || metrics.lostDomains.length > 0) && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">来源变化</CardTitle>
            <p className="mt-1 text-xs text-muted-foreground">对比上一批次（相同项目）</p>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2">
            <div>
              <div className="mb-2 text-xs font-medium text-emerald-600 dark:text-emerald-400">
                新增 {metrics.newDomains.length}
              </div>
              <div className="flex flex-wrap gap-1.5">
                {metrics.newDomains.map((domain) => (
                  <Badge key={domain} variant="secondary" className="font-normal">
                    {domain}
                  </Badge>
                ))}
              </div>
            </div>
            <div>
              <div className="mb-2 text-xs font-medium text-muted-foreground">
                流失 {metrics.lostDomains.length}
              </div>
              <div className="flex flex-wrap gap-1.5">
                {metrics.lostDomains.map((domain) => (
                  <Badge key={domain} variant="outline" className="font-normal text-muted-foreground">
                    {domain}
                  </Badge>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
