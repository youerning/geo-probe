"use client";

import { Globe2, Quote, Trophy, Users } from "lucide-react";
import { KpiCard } from "@/components/kpi-card";
import { InsightList } from "@/components/insight-list";
import { MethodologyNote } from "@/components/methodology-note";
import { ChartCard } from "@/components/charts/chart-card";
import { TagMentionChart } from "@/components/charts/tag-mention-chart";
import { ChannelDonut } from "@/components/charts/channel-donut";
import { TopDomainsChart } from "@/components/charts/top-domains-chart";
import { SovChart } from "@/components/charts/sov-chart";
import { Badge } from "@/components/ui/badge";
import type { RunMetrics } from "@/lib/types";
import { formatPercent } from "@/lib/utils/format";

export function OverviewTab({ metrics }: { metrics: RunMetrics }) {
  const brandSov = metrics.sov.find((item) => item.kind === "brand");
  const competitorMentions = metrics.sov
    .filter((item) => item.kind === "competitor")
    .reduce((sum, item) => sum + item.mentionCount, 0);

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          label="提及率"
          value={formatPercent(metrics.mentionRate)}
          hint={`${metrics.mentionCount}/${metrics.successCount} 次探测命中`}
          icon={Quote}
          tone="primary"
        />
        <KpiCard
          label="首位提及率"
          value={formatPercent(metrics.firstRate)}
          hint={`${metrics.firstCount} 次探测里品牌第一个被提到`}
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
              ? `最佳位次 ${metrics.ownedDomain.bestRank ?? "—"}`
              : "官网未进入检索来源"
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
        <ChartCard title="Top 来源域名" description="按出现率排序">
          <TopDomainsChart data={metrics.domainStats} />
        </ChartCard>
        <ChartCard title="竞品声量份额" description="各追踪目标在探测中被提及的比例">
          <SovChart data={metrics.sov} />
        </ChartCard>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <ChartCard title="来源渠道" description="百科、社交、微信、新闻……">
          <ChannelDonut data={metrics.channelDistribution} />
        </ChartCard>
        <div className="lg:col-span-2">
          <div className="grid gap-2 sm:grid-cols-2">
            <div className="rounded-xl border p-4">
              <div className="text-xs font-medium text-muted-foreground">新增来源域名</div>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {metrics.newDomains.length ? (
                  metrics.newDomains.slice(0, 12).map((domain) => (
                    <Badge key={domain} variant="secondary" className="font-normal">
                      {domain}
                    </Badge>
                  ))
                ) : (
                  <span className="text-xs text-muted-foreground">—</span>
                )}
              </div>
            </div>
            <div className="rounded-xl border p-4">
              <div className="text-xs font-medium text-muted-foreground">流失来源域名</div>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {metrics.lostDomains.length ? (
                  metrics.lostDomains.slice(0, 12).map((domain) => (
                    <Badge key={domain} variant="outline" className="font-normal text-muted-foreground">
                      {domain}
                    </Badge>
                  ))
                ) : (
                  <span className="text-xs text-muted-foreground">—</span>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      <MethodologyNote compact />
    </div>
  );
}
