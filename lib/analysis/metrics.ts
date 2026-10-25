import {
  DEFAULT_MODEL,
  MODEL_MAP,
  PROMPT_TAGS,
  SOURCE_CHANNEL_LABELS,
  SOURCE_OWNERSHIP_LABELS,
} from "@/lib/config";
import type {
  ChannelStat,
  DomainStat,
  Insight,
  Probe,
  ProbeMetrics,
  Prompt,
  PromptMetrics,
  Run,
  RunMetrics,
  SourceChannel,
  SourceOwnership,
  SovItem,
  TagMetric,
  Target,
} from "@/lib/types";
import { formatPercent } from "@/lib/utils/format";

export function getBrand(run: Run): Target | undefined {
  return run.aliasSnapshot.find((target) => target.kind === "brand");
}

export function hasBrandMention(probe: Probe, brandId: string): boolean {
  return probe.mentions.some((mention) => mention.targetId === brandId);
}

export function computeProbeMetrics(probe: Probe, brandId: string): ProbeMetrics {
  const brandMention = probe.mentions.find((mention) => mention.targetId === brandId);

  const domainSet = new Set(
    probe.sources.map((source) => source.domain || source.host).filter(Boolean),
  );

  const ownedSources = probe.sources.filter((source) => source.ownership === "owned");
  const ownedRanks = ownedSources.flatMap((source) =>
    source.occurrences.map((occurrence) => occurrence.rank),
  );

  const channelCounts: Partial<Record<SourceChannel, number>> = {};
  for (const source of probe.sources) {
    channelCounts[source.channel] = (channelCounts[source.channel] ?? 0) + 1;
  }

  return {
    brandMention: !!brandMention,
    brandOrder: brandMention?.order ?? null,
    brandFirst: brandMention?.order === 1,
    brandListPosition: brandMention?.listPosition ?? null,
    sourceCount: probe.sources.length,
    uniqueDomainCount: domainSet.size,
    ownedDomainPresent: ownedSources.length > 0,
    ownedDomainBestRank: ownedRanks.length ? Math.min(...ownedRanks) : null,
    channelCounts,
    tokenCount: probe.usage.inputTokens + probe.usage.outputTokens,
    answerChars: probe.answerChars,
  };
}

function domainSets(probes: Probe[]): Map<string, Set<string>> {
  return new Map(
    probes.map((probe) => [
      probe.id,
      new Set(probe.sources.map((source) => source.domain || source.host).filter(Boolean)),
    ]),
  );
}

function jaccard(a: Set<string>, b: Set<string>): number | null {
  const union = new Set([...a, ...b]);
  if (union.size === 0) return null;
  let intersection = 0;
  for (const value of a) if (b.has(value)) intersection += 1;
  return intersection / union.size;
}

export function computeSourceStability(probes: Probe[]): number | null {
  const successes = probes.filter((probe) => probe.status === "success");
  if (successes.length < 2) return null;

  const byPrompt = new Map<string, Probe[]>();
  for (const probe of successes) {
    const list = byPrompt.get(probe.promptId);
    if (list) list.push(probe);
    else byPrompt.set(probe.promptId, [probe]);
  }

  const promptScores: number[] = [];

  for (const group of byPrompt.values()) {
    if (group.length < 2) continue;
    const sets = domainSets(group);
    const values = Array.from(sets.values());
    const pairs: number[] = [];

    for (let i = 0; i < values.length; i += 1) {
      for (let j = i + 1; j < values.length; j += 1) {
        const score = jaccard(values[i], values[j]);
        if (score !== null) pairs.push(score);
      }
    }

    if (pairs.length) {
      promptScores.push(pairs.reduce((sum, value) => sum + value, 0) / pairs.length);
    }
  }

  if (!promptScores.length) return null;
  return promptScores.reduce((sum, value) => sum + value, 0) / promptScores.length;
}

export function computePromptMetrics(
  prompt: Pick<Prompt, "id" | "text" | "tags">,
  probes: Probe[],
  brandId: string,
): PromptMetrics {
  const group = probes.filter((probe) => probe.promptId === prompt.id);
  const successes = group.filter((probe) => probe.status === "success");
  const mentions = successes.filter((probe) => hasBrandMention(probe, brandId));
  const firsts = mentions.filter((probe) => {
    const mention = probe.mentions.find((item) => item.targetId === brandId);
    return mention?.order === 1;
  });

  const orders = mentions
    .map((probe) => probe.mentions.find((mention) => mention.targetId === brandId)?.order)
    .filter((value): value is number => typeof value === "number");

  const listPositions = mentions
    .map((probe) => probe.mentions.find((mention) => mention.targetId === brandId)?.listPosition)
    .filter((value): value is number => typeof value === "number");

  const domainCounts = new Map<string, number>();
  for (const probe of successes) {
    const seen = new Set<string>();
    for (const source of probe.sources) {
      const key = source.domain || source.host;
      if (!key || seen.has(key)) continue;
      seen.add(key);
      domainCounts.set(key, (domainCounts.get(key) ?? 0) + 1);
    }
  }

  const topDomains = Array.from(domainCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([domain]) => domain);

  const owned = successes.filter((probe) =>
    probe.sources.some((source) => source.ownership === "owned"),
  );

  return {
    promptId: prompt.id,
    text: prompt.text,
    tags: prompt.tags,
    probeCount: group.length,
    successCount: successes.length,
    mentionCount: mentions.length,
    mentionRate: successes.length ? mentions.length / successes.length : 0,
    firstCount: firsts.length,
    firstRate: successes.length ? firsts.length / successes.length : 0,
    avgOrder: orders.length ? orders.reduce((sum, value) => sum + value, 0) / orders.length : null,
    avgListPosition: listPositions.length
      ? listPositions.reduce((sum, value) => sum + value, 0) / listPositions.length
      : null,
    sourceStability: computeSourceStability(successes),
    topDomains,
    ownedDomainRate: successes.length ? owned.length / successes.length : 0,
  };
}

export function computeTagMetrics(probes: Probe[], prompts: Prompt[]): TagMetric[] {
  const tags = new Map<string, string>();
  for (const tag of PROMPT_TAGS) tags.set(tag.value, tag.label);
  for (const prompt of prompts) {
    for (const tag of prompt.tags) {
      if (!tags.has(tag)) tags.set(tag, tag);
    }
  }

  const promptTags = new Map(prompts.map((prompt) => [prompt.id, new Set(prompt.tags)]));
  const successes = probes.filter((probe) => probe.status === "success");

  const metrics: TagMetric[] = [];

  for (const [tag, label] of tags) {
    const group = successes.filter((probe) => promptTags.get(probe.promptId)?.has(tag));
    if (!group.length) continue;
    metrics.push({
      tag,
      label,
      probeCount: probes.filter((probe) => promptTags.get(probe.promptId)?.has(tag)).length,
      successCount: group.length,
      mentionCount: 0,
      mentionRate: 0,
      firstCount: 0,
      firstRate: 0,
    });
  }

  return metrics;
}

export function computeTagMetricsForBrand(
  probes: Probe[],
  prompts: Prompt[],
  brandId: string,
): TagMetric[] {
  const base = computeTagMetrics(probes, prompts);
  const promptTags = new Map(prompts.map((prompt) => [prompt.id, new Set(prompt.tags)]));

  return base.map((metric) => {
    const group = probes.filter(
      (probe) =>
        probe.status === "success" && promptTags.get(probe.promptId)?.has(metric.tag),
    );
    const mentions = group.filter((probe) => hasBrandMention(probe, brandId));
    const firsts = mentions.filter(
      (probe) => probe.mentions.find((mention) => mention.targetId === brandId)?.order === 1,
    );

    return {
      ...metric,
      mentionCount: mentions.length,
      mentionRate: group.length ? mentions.length / group.length : 0,
      firstCount: firsts.length,
      firstRate: group.length ? firsts.length / group.length : 0,
    };
  });
}

export function computeDomainStats(probes: Probe[]): DomainStat[] {
  const successes = probes.filter((probe) => probe.status === "success");
  const totalOccurrences = successes.reduce(
    (sum, probe) => sum + probe.sources.reduce((inner, source) => inner + source.occurrences.length, 0),
    0,
  );

  type Acc = {
    domain: string;
    host: string;
    platform: string;
    channel: SourceChannel;
    ownership: SourceOwnership;
    probes: Set<string>;
    occurrenceCount: number;
    ranks: number[];
    promptIds: Set<string>;
    queries: Set<string>;
    firstSeen: string;
    lastSeen: string;
    titles: Set<string>;
    urls: Set<string>;
  };

  const map = new Map<string, Acc>();

  for (const probe of successes) {
    for (const source of probe.sources) {
      const key = source.domain || source.host || source.platform;
      if (!key) continue;

      let acc = map.get(key);
      if (!acc) {
        acc = {
          domain: key,
          host: source.host,
          platform: source.platform,
          channel: source.channel,
          ownership: source.ownership,
          probes: new Set(),
          occurrenceCount: 0,
          ranks: [],
          promptIds: new Set(),
          queries: new Set(),
          firstSeen: probe.startedAt,
          lastSeen: probe.startedAt,
          titles: new Set(),
          urls: new Set(),
        };
        map.set(key, acc);
      }

      acc.probes.add(probe.id);
      acc.promptIds.add(probe.promptId);
      acc.occurrenceCount += source.occurrences.length;
      for (const occurrence of source.occurrences) {
        acc.ranks.push(occurrence.rank);
        if (occurrence.query) acc.queries.add(occurrence.query);
      }
      if (probe.startedAt < acc.firstSeen) acc.firstSeen = probe.startedAt;
      if (probe.startedAt > acc.lastSeen) acc.lastSeen = probe.startedAt;
      if (source.title) acc.titles.add(source.title);
      if (source.url) acc.urls.add(source.url);
    }
  }

  const stats: DomainStat[] = [];
  for (const acc of map.values()) {
    stats.push({
      domain: acc.domain,
      host: acc.host,
      platform: acc.platform,
      channel: acc.channel,
      ownership: acc.ownership,
      probeCount: acc.probes.size,
      appearanceRate: successes.length ? acc.probes.size / successes.length : 0,
      occurrenceCount: acc.occurrenceCount,
      share: totalOccurrences ? acc.occurrenceCount / totalOccurrences : 0,
      avgRank: acc.ranks.length
        ? acc.ranks.reduce((sum, value) => sum + value, 0) / acc.ranks.length
        : 0,
      bestRank: acc.ranks.length ? Math.min(...acc.ranks) : 0,
      promptIds: Array.from(acc.promptIds),
      queries: Array.from(acc.queries).slice(0, 20),
      firstSeen: acc.firstSeen,
      lastSeen: acc.lastSeen,
      sampleTitles: Array.from(acc.titles).slice(0, 3),
      sampleUrls: Array.from(acc.urls).slice(0, 3),
    });
  }

  stats.sort((a, b) => {
    if (b.probeCount !== a.probeCount) return b.probeCount - a.probeCount;
    if (b.occurrenceCount !== a.occurrenceCount) return b.occurrenceCount - a.occurrenceCount;
    return a.domain.localeCompare(b.domain, "zh-CN");
  });

  return stats;
}

export function computeDomainSet(probes: Probe[]): Set<string> {
  const set = new Set<string>();
  for (const probe of probes) {
    if (probe.status !== "success") continue;
    for (const source of probe.sources) {
      const key = source.domain || source.host;
      if (key) set.add(key);
    }
  }
  return set;
}

export function computeNewLostDomains(current: Probe[], previous: Probe[]) {
  const currentSet = computeDomainSet(current);
  const previousSet = computeDomainSet(previous);
  const newDomains = Array.from(currentSet).filter((domain) => !previousSet.has(domain));
  const lostDomains = Array.from(previousSet).filter((domain) => !currentSet.has(domain));
  return { newDomains, lostDomains };
}

export function computeSov(probes: Probe[], targets: Target[]): SovItem[] {
  const successes = probes.filter((probe) => probe.status === "success");
  const counts = targets.map((target) => ({
    target,
    count: successes.filter((probe) =>
      probe.mentions.some((mention) => mention.targetId === target.id),
    ).length,
  }));

  const total = counts.reduce((sum, item) => sum + item.count, 0);

  return counts
    .map(({ target, count }) => ({
      targetId: target.id,
      label: target.label,
      kind: target.kind,
      mentionCount: count,
      share: total ? count / total : 0,
    }))
    .sort((a, b) => {
      if (b.mentionCount !== a.mentionCount) return b.mentionCount - a.mentionCount;
      if (a.kind === "brand") return -1;
      if (b.kind === "brand") return 1;
      return a.label.localeCompare(b.label, "zh-CN");
    });
}

export function computeChannelDistribution(probes: Probe[]): ChannelStat[] {
  const counts = new Map<string, number>();
  let total = 0;

  for (const probe of probes) {
    if (probe.status !== "success") continue;
    for (const source of probe.sources) {
      const count = source.occurrences.length;
      counts.set(source.channel, (counts.get(source.channel) ?? 0) + count);
      total += count;
    }
  }

  return Array.from(counts.entries())
    .map(([key, count]) => ({
      key,
      label: SOURCE_CHANNEL_LABELS[key as SourceChannel] ?? key,
      count,
      share: total ? count / total : 0,
    }))
    .sort((a, b) => b.count - a.count);
}

export function computeOwnershipDistribution(probes: Probe[]): ChannelStat[] {
  const counts = new Map<string, number>();
  let total = 0;

  for (const probe of probes) {
    if (probe.status !== "success") continue;
    for (const source of probe.sources) {
      const count = source.occurrences.length;
      counts.set(source.ownership, (counts.get(source.ownership) ?? 0) + count);
      total += count;
    }
  }

  return Array.from(counts.entries())
    .map(([key, count]) => ({
      key,
      label: SOURCE_OWNERSHIP_LABELS[key as SourceOwnership] ?? key,
      count,
      share: total ? count / total : 0,
    }))
    .sort((a, b) => b.count - a.count);
}

export function computeOwnedDomain(probes: Probe[]) {
  const successes = probes.filter((probe) => probe.status === "success");
  const withOwned = successes.filter((probe) =>
    probe.sources.some((source) => source.ownership === "owned"),
  );
  const ranks = successes.flatMap((probe) =>
    probe.sources
      .filter((source) => source.ownership === "owned")
      .flatMap((source) => source.occurrences.map((occurrence) => occurrence.rank)),
  );

  return {
    present: withOwned.length > 0,
    probeCount: withOwned.length,
    rate: successes.length ? withOwned.length / successes.length : 0,
    bestRank: ranks.length ? Math.min(...ranks) : null,
  };
}

export function computeAnswerLinkOverlap(probes: Probe[]): number | null {
  const links = probes.flatMap((probe) => probe.answerLinks);
  if (!links.length) return null;
  return links.filter((link) => link.inSources).length / links.length;
}

export function estimateCost(
  inputTokens: number,
  outputTokens: number,
  webSearchRequests: number,
  model: string,
): number {
  const prices = MODEL_MAP[model] ?? MODEL_MAP[DEFAULT_MODEL];
  return (
    (inputTokens / 1_000_000) * prices.inputPerMillion +
    (outputTokens / 1_000_000) * prices.outputPerMillion +
    webSearchRequests * prices.searchPerCall
  );
}

function buildInsights(
  metrics: Omit<RunMetrics, "insights">,
  probes: Probe[],
): Insight[] {
  const insights: Insight[] = [];
  const successes = probes.filter((probe) => probe.status === "success");

  if (!successes.length) {
    return [
      {
        tone: "neutral",
        title: "还没有完成的探测",
        description: "先运行一个批次，看 AI 会不会在回答里提到你的品牌。",
      },
    ];
  }

  const general = metrics.tagMetrics.find((tag) => tag.tag === "general");
  const brand = metrics.tagMetrics.find((tag) => tag.tag === "brand");

  if (general && general.successCount > 0 && general.mentionCount === 0) {
    insights.push({
      tone: "warning",
      title: "通用词没有被提及",
      description: `通用词提及率为 0%（${general.successCount} 次探测）。AI 认识你，但不会在品类推荐里主动提到你。`,
    });
  }

  if (brand && brand.successCount > 0 && brand.mentionCount > 0) {
    insights.push({
      tone: "positive",
      title: "品牌词能被识别",
      description: `品牌词提及率 ${formatPercent(brand.mentionRate)}。说明 AI 知道你的品牌，问题主要在通用词的推荐链路。`,
    });
  }

  if (!metrics.ownedDomain.present) {
    insights.push({
      tone: "warning",
      title: "官网未进入检索来源",
      description:
        "AI 的检索来源里没有出现你的官网域名。先检查官网是否被搜索收录，以及内容是否覆盖这些提问。",
    });
  }

  const top = metrics.domainStats[0];
  if (top) {
    insights.push({
      tone: "neutral",
      title: `Top 来源：${top.platform}`,
      description: `出现在 ${formatPercent(top.appearanceRate)} 的探测中，平均位次 ${top.avgRank.toFixed(1)}，共 ${top.occurrenceCount} 次来源记录。`,
    });
  }

  if (metrics.sourceStability !== null && metrics.sourceStability < 0.4) {
    insights.push({
      tone: "warning",
      title: "来源稳定性偏低",
      description: `${formatPercent(metrics.sourceStability)}。同一问题多次提问，来源重合度不高，建议看多次平均，而不是单次结果。`,
    });
  }

  if (metrics.newDomains.length || metrics.lostDomains.length) {
    insights.push({
      tone: "neutral",
      title: "来源发生变化",
      description: `对比上一批次：新增 ${metrics.newDomains.length} 个来源域名，流失 ${metrics.lostDomains.length} 个。`,
    });
  }

  if (metrics.mentionRate >= 0.8) {
    insights.push({
      tone: "positive",
      title: "品牌提及率很高",
      description: `${formatPercent(metrics.mentionRate)} 的回答里出现了你的品牌，继续保持。`,
    });
  } else if (metrics.mentionRate < 0.2) {
    insights.push({
      tone: "warning",
      title: "品牌提及率偏低",
      description: `${formatPercent(metrics.mentionRate)}。通用词是主要缺口，优先补充能被 AI 检索到的内容。`,
    });
  }

  const seen = new Set<string>();
  return insights.filter((insight) => {
    if (seen.has(insight.title)) return false;
    seen.add(insight.title);
    return true;
  }).slice(0, 5);
}

export function computeRunMetrics(params: {
  run: Run;
  probes: Probe[];
  prompts: Prompt[];
  previousProbes?: Probe[];
}): RunMetrics {
  const { run, probes, prompts, previousProbes = [] } = params;
  const brand = getBrand(run);
  const brandId = brand?.id ?? "brand";
  const successes = probes.filter((probe) => probe.status === "success");
  const errors = probes.filter((probe) => probe.status === "error" || probe.status === "empty");

  const mentions = successes.filter((probe) => hasBrandMention(probe, brandId));
  const firsts = mentions.filter(
    (probe) => probe.mentions.find((mention) => mention.targetId === brandId)?.order === 1,
  );

  const orders = mentions
    .map((probe) => probe.mentions.find((mention) => mention.targetId === brandId)?.order)
    .filter((value): value is number => typeof value === "number");
  const listPositions = mentions
    .map((probe) => probe.mentions.find((mention) => mention.targetId === brandId)?.listPosition)
    .filter((value): value is number => typeof value === "number");

  const domainStats = computeDomainStats(successes);
  const { newDomains, lostDomains } = previousProbes.length
    ? computeNewLostDomains(successes, previousProbes)
    : { newDomains: [] as string[], lostDomains: [] as string[] };

  for (const stat of domainStats) {
    if (newDomains.includes(stat.domain)) stat.change = "new";
  }

  const inputTokens = successes.reduce((sum, probe) => sum + probe.usage.inputTokens, 0);
  const outputTokens = successes.reduce((sum, probe) => sum + probe.usage.outputTokens, 0);
  const webSearchRequests = successes.reduce(
    (sum, probe) => sum + probe.usage.webSearchRequests,
    0,
  );

  const base: Omit<RunMetrics, "insights"> = {
    probeCount: probes.length,
    successCount: successes.length,
    errorCount: errors.length,
    mentionCount: mentions.length,
    mentionRate: successes.length ? mentions.length / successes.length : 0,
    firstCount: firsts.length,
    firstRate: successes.length ? firsts.length / successes.length : 0,
    avgOrder: orders.length ? orders.reduce((sum, value) => sum + value, 0) / orders.length : null,
    avgListPosition: listPositions.length
      ? listPositions.reduce((sum, value) => sum + value, 0) / listPositions.length
      : null,
    uniqueDomainCount: new Set(domainStats.map((stat) => stat.domain)).size,
    sov: computeSov(successes, run.aliasSnapshot),
    tagMetrics: computeTagMetricsForBrand(successes, prompts, brandId),
    domainStats,
    channelDistribution: computeChannelDistribution(successes),
    ownershipDistribution: computeOwnershipDistribution(successes),
    ownedDomain: computeOwnedDomain(successes),
    sourceStability: computeSourceStability(successes),
    newDomains,
    lostDomains,
    answerLinkOverlap: computeAnswerLinkOverlap(successes),
    inputTokens,
    outputTokens,
    webSearchRequests,
    avgLatencyMs: successes.length
      ? successes.reduce((sum, probe) => sum + probe.latencyMs, 0) / successes.length
      : 0,
    estimatedCost: estimateCost(inputTokens, outputTokens, webSearchRequests, run.config.model),
  };

  return {
    ...base,
    insights: buildInsights(base, probes),
  };
}

export function computePromptMetricsList(
  prompts: Prompt[],
  probes: Probe[],
  brandId: string,
): PromptMetrics[] {
  return prompts.map((prompt) => computePromptMetrics(prompt, probes, brandId));
}

export function emptyRunMetrics(): RunMetrics {
  return {
    probeCount: 0,
    successCount: 0,
    errorCount: 0,
    mentionCount: 0,
    mentionRate: 0,
    firstCount: 0,
    firstRate: 0,
    avgOrder: null,
    avgListPosition: null,
    uniqueDomainCount: 0,
    sov: [],
    tagMetrics: [],
    domainStats: [],
    channelDistribution: [],
    ownershipDistribution: [],
    ownedDomain: { present: false, probeCount: 0, rate: 0, bestRank: null },
    sourceStability: null,
    newDomains: [],
    lostDomains: [],
    answerLinkOverlap: null,
    inputTokens: 0,
    outputTokens: 0,
    webSearchRequests: 0,
    avgLatencyMs: 0,
    estimatedCost: 0,
    insights: [],
  };
}
