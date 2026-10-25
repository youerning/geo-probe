import { describe, expect, it } from "vitest";
import {
  computePromptMetrics,
  computeProbeMetrics,
  computeRunMetrics,
  computeSourceStability,
} from "@/lib/analysis/metrics";
import type { Probe, Prompt, Run, SearchSource, Target } from "@/lib/types";

const BRAND: Target = {
  id: "brand",
  kind: "brand",
  label: "元构场",
  aliases: ["元构场"],
  domains: ["yuangouchang.com"],
};

const COMPETITOR: Target = {
  id: "comp_1",
  kind: "competitor",
  label: "竞品 A",
  aliases: ["飞柚GEO"],
  domains: ["feiyougeo.cn"],
};

const RUN: Run = {
  id: "run_1",
  projectId: "prj_1",
  name: "测试批次",
  status: "completed",
  config: {
    model: "deepseek-v4-flash",
    maxTokens: 3000,
    maxUses: 5,
    systemPrompt: "test",
    systemPromptVersion: "v1",
    temperature: 1,
    thinking: "default",
    endpoint: "https://api.deepseek.com/anthropic/v1/messages",
    repeats: 3,
    concurrency: 2,
  },
  aliasSnapshot: [BRAND, COMPETITOR],
  promptSnapshot: [],
  plannedProbeCount: 3,
  startedAt: "2026-10-25T10:00:00.000Z",
  finishedAt: "2026-10-25T10:02:00.000Z",
  createdAt: "2026-10-25T10:00:00.000Z",
  appVersion: "0.1.0",
  schemaVersion: 1,
};

const PROMPTS: Prompt[] = [
  {
    id: "p1",
    projectId: "prj_1",
    text: "推荐几家深圳 GEO 公司",
    tags: ["general"],
    enabled: true,
    createdAt: "2026-10-25T09:00:00.000Z",
    updatedAt: "2026-10-25T09:00:00.000Z",
  },
  {
    id: "p2",
    projectId: "prj_1",
    text: "元构场 GEO 服务怎么样",
    tags: ["brand"],
    enabled: true,
    createdAt: "2026-10-25T09:00:00.000Z",
    updatedAt: "2026-10-25T09:00:00.000Z",
  },
];

function source(
  domain: string,
  ownership: SearchSource["ownership"],
  rank: number,
  title = domain,
): SearchSource {
  return {
    id: `src_${domain}`,
    title,
    url: `https://${domain}/page`,
    canonicalUrl: `https://${domain}/page`,
    host: domain,
    domain,
    platform: domain,
    pageAge: null,
    channel: "other",
    ownership,
    titleMentions: [],
    occurrences: [
      {
        queryId: "q1",
        query: "深圳 GEO 公司",
        rank,
      },
    ],
  };
}

function probe(params: {
  id: string;
  promptId: string;
  mentionTargetId?: string;
  sources?: SearchSource[];
  status?: Probe["status"];
}): Probe {
  const { id, promptId, mentionTargetId, sources = [], status = "success" } = params;
  const target = mentionTargetId === "brand" ? BRAND : COMPETITOR;

  return {
    id,
    runId: RUN.id,
    projectId: RUN.projectId,
    promptId,
    promptText: PROMPTS.find((prompt) => prompt.id === promptId)?.text ?? "",
    promptTags: PROMPTS.find((prompt) => prompt.id === promptId)?.tags ?? [],
    repeatIndex: 1,
    status,
    startedAt: "2026-10-25T10:00:00.000Z",
    finishedAt: "2026-10-25T10:00:10.000Z",
    latencyMs: 10_000,
    model: "deepseek-v4-flash",
    answer: mentionTargetId ? `${target.label} 提供 GEO 服务。` : "其他公司。",
    answerChars: 20,
    answerLinks: [],
    queries: [
      {
        id: "q1",
        query: "深圳 GEO 公司",
        order: 1,
        resultCount: sources.length,
      },
    ],
    sources,
    mentions: mentionTargetId
      ? [
          {
            targetId: mentionTargetId,
            targetLabel: target.label,
            alias: target.label,
            matchedAliases: [target.label],
            count: 1,
            firstIndex: 0,
            context: `${target.label} 提供 GEO 服务。`,
            order: 1,
            listPosition: null,
          },
        ]
      : [],
    listItems: [],
    otherEntities: [],
    usage: {
      inputTokens: 10_000,
      outputTokens: 1_000,
      cacheReadTokens: 0,
      webSearchRequests: 2,
    },
    attempts: 1,
    createdAt: "2026-10-25T10:00:00.000Z",
  };
}

describe("computeProbeMetrics", () => {
  it("computes mention, owned domain and token metrics", () => {
    const p = probe({
      id: "probe_1",
      promptId: "p2",
      mentionTargetId: "brand",
      sources: [source("yuangouchang.com", "owned", 1)],
    });
    const metrics = computeProbeMetrics(p, "brand");
    expect(metrics.brandMention).toBe(true);
    expect(metrics.brandFirst).toBe(true);
    expect(metrics.ownedDomainPresent).toBe(true);
    expect(metrics.ownedDomainBestRank).toBe(1);
    expect(metrics.tokenCount).toBe(11_000);
  });
});

describe("computeRunMetrics", () => {
  const probes = [
    probe({
      id: "probe_1",
      promptId: "p1",
      mentionTargetId: "comp_1",
      sources: [source("baike.baidu.com", "third_party", 2)],
    }),
    probe({
      id: "probe_2",
      promptId: "p2",
      mentionTargetId: "brand",
      sources: [source("yuangouchang.com", "owned", 1)],
    }),
    probe({
      id: "probe_3",
      promptId: "p2",
      mentionTargetId: "brand",
      sources: [source("yuangouchang.com", "owned", 2)],
    }),
  ];

  it("computes mention rate, SoV and tag metrics", () => {
    const metrics = computeRunMetrics({ run: RUN, probes, prompts: PROMPTS });
    expect(metrics.successCount).toBe(3);
    expect(metrics.mentionCount).toBe(2);
    expect(metrics.mentionRate).toBeCloseTo(2 / 3);
    expect(metrics.sov.find((item) => item.kind === "brand")?.share).toBeCloseTo(2 / 3);
    expect(metrics.tagMetrics.find((tag) => tag.tag === "general")?.mentionRate).toBe(0);
    expect(metrics.tagMetrics.find((tag) => tag.tag === "brand")?.mentionRate).toBe(1);
    expect(metrics.ownedDomain.rate).toBeCloseTo(2 / 3);
    expect(metrics.sourceStability).toBe(1);
  });

  it("computes new and lost domains against the previous run", () => {
    const previous = [
      probe({
        id: "old_1",
        promptId: "p1",
        sources: [source("old.com", "third_party", 1), source("baidu.com", "third_party", 2)],
      }),
    ];
    const metrics = computeRunMetrics({
      run: RUN,
      probes,
      prompts: PROMPTS,
      previousProbes: previous,
    });
    expect(metrics.newDomains).toContain("yuangouchang.com");
    expect(metrics.lostDomains).toContain("old.com");
  });
});

describe("computeSourceStability", () => {
  it("returns 1 for identical source sets and 0 for disjoint sets", () => {
    const identical = [
      probe({
        id: "a",
        promptId: "p1",
        sources: [source("a.com", "third_party", 1)],
      }),
      probe({
        id: "b",
        promptId: "p1",
        sources: [source("a.com", "third_party", 1)],
      }),
    ];
    expect(computeSourceStability(identical)).toBe(1);

    const disjoint = [
      probe({
        id: "c",
        promptId: "p1",
        sources: [source("a.com", "third_party", 1)],
      }),
      probe({
        id: "d",
        promptId: "p1",
        sources: [source("b.com", "third_party", 1)],
      }),
    ];
    expect(computeSourceStability(disjoint)).toBe(0);
  });
});

describe("computePromptMetrics", () => {
  it("handles a prompt with no probes", () => {
    const metrics = computePromptMetrics(PROMPTS[0], [], "brand");
    expect(metrics.probeCount).toBe(0);
    expect(metrics.mentionRate).toBe(0);
    expect(metrics.sourceStability).toBeNull();
  });
});
