export type TargetKind = "brand" | "competitor";

export type Target = {
  id: string;
  kind: TargetKind;
  label: string;
  aliases: string[];
  domains: string[];
};

export type Project = {
  id: string;
  name: string;
  brand: Target;
  competitors: Target[];
  locale: string;
  isDemo?: boolean;
  description?: string;
  createdAt: string;
  updatedAt: string;
};

export type Prompt = {
  id: string;
  projectId: string;
  text: string;
  tags: string[];
  enabled: boolean;
  note?: string;
  createdAt: string;
  updatedAt: string;
};

export type RunConfig = {
  model: string;
  maxTokens: number;
  maxUses: number;
  systemPrompt: string;
  systemPromptVersion: string;
  temperature: number;
  thinking: string;
  endpoint: string;
  repeats: number;
  concurrency: number;
};

export type RunStatus =
  | "queued"
  | "running"
  | "completed"
  | "partial"
  | "failed"
  | "cancelled";

export type Run = {
  id: string;
  projectId: string;
  name: string;
  status: RunStatus;
  config: RunConfig;
  aliasSnapshot: Target[];
  promptSnapshot: Array<Pick<Prompt, "id" | "text" | "tags">>;
  previousRunId?: string;
  plannedProbeCount: number;
  startedAt: string;
  finishedAt?: string;
  createdAt: string;
  note?: string;
  appVersion: string;
  schemaVersion: number;
};

export type SearchQuery = {
  id: string;
  query: string;
  order: number;
  resultCount: number;
  error?: string;
};

export type SourceChannel =
  | "encyclopedia"
  | "social"
  | "wechat"
  | "news"
  | "directory"
  | "app_store"
  | "official"
  | "other";

export type SourceOwnership = "owned" | "competitor" | "third_party";

export type SourceOccurrence = {
  queryId: string;
  query: string;
  rank: number;
};

export type RawSource = {
  queryId: string;
  query: string;
  rank: number;
  title: string;
  url: string;
  pageAge: string | null;
};

export type SearchSource = {
  id: string;
  title: string;
  url: string;
  canonicalUrl: string;
  host: string;
  domain: string;
  platform: string;
  pageAge: string | null;
  channel: SourceChannel;
  ownership: SourceOwnership;
  competitorId?: string;
  titleMentions: string[];
  occurrences: SourceOccurrence[];
};

export type Mention = {
  targetId: string;
  targetLabel: string;
  alias: string;
  matchedAliases: string[];
  count: number;
  firstIndex: number;
  context: string;
  order: number;
  listPosition: number | null;
};

export type ListItem = {
  index: number;
  raw: string;
  title: string;
  matchedTargetId?: string;
  matchedLabel?: string;
};

export type AnswerLink = {
  url: string;
  canonicalUrl: string;
  host: string;
  domain: string;
  platform: string;
  channel: SourceChannel;
  ownership: SourceOwnership;
  inSources: boolean;
};

export type ProbeStatus = "success" | "error" | "empty" | "cancelled";

export type ProbeUsage = {
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  webSearchRequests: number;
};

export type ProbeError = {
  message: string;
  code?: string;
  retryable?: boolean;
};

export type Probe = {
  id: string;
  runId: string;
  projectId: string;
  promptId: string;
  promptText: string;
  promptTags: string[];
  repeatIndex: number;
  status: ProbeStatus;
  startedAt: string;
  finishedAt: string;
  latencyMs: number;
  model: string;
  requestId?: string;
  stopReason?: string | null;
  answer: string;
  answerChars: number;
  answerLinks: AnswerLink[];
  queries: SearchQuery[];
  sources: SearchSource[];
  mentions: Mention[];
  listItems: ListItem[];
  otherEntities: string[];
  usage: ProbeUsage;
  error?: ProbeError;
  attempts: number;
  createdAt: string;
};

export type ProbeMetrics = {
  brandMention: boolean;
  brandOrder: number | null;
  brandFirst: boolean;
  brandListPosition: number | null;
  sourceCount: number;
  uniqueDomainCount: number;
  ownedDomainPresent: boolean;
  ownedDomainBestRank: number | null;
  channelCounts: Partial<Record<SourceChannel, number>>;
  tokenCount: number;
  answerChars: number;
};

export type DomainStat = {
  domain: string;
  host: string;
  platform: string;
  channel: SourceChannel;
  ownership: SourceOwnership;
  probeCount: number;
  appearanceRate: number;
  occurrenceCount: number;
  share: number;
  avgRank: number;
  bestRank: number;
  promptIds: string[];
  queries: string[];
  firstSeen: string;
  lastSeen: string;
  sampleTitles: string[];
  sampleUrls: string[];
  change?: "new" | "lost";
};

export type SovItem = {
  targetId: string;
  label: string;
  kind: TargetKind;
  mentionCount: number;
  share: number;
};

export type TagMetric = {
  tag: string;
  label: string;
  probeCount: number;
  successCount: number;
  mentionCount: number;
  mentionRate: number;
  firstCount: number;
  firstRate: number;
};

export type ChannelStat = {
  key: string;
  label: string;
  count: number;
  share: number;
};

export type InsightTone = "positive" | "warning" | "neutral";

export type Insight = {
  tone: InsightTone;
  title: string;
  description: string;
};

export type PromptMetrics = {
  promptId: string;
  text: string;
  tags: string[];
  probeCount: number;
  successCount: number;
  mentionCount: number;
  mentionRate: number;
  firstCount: number;
  firstRate: number;
  avgOrder: number | null;
  avgListPosition: number | null;
  sourceStability: number | null;
  topDomains: string[];
  ownedDomainRate: number;
};

export type RunMetrics = {
  probeCount: number;
  successCount: number;
  errorCount: number;
  mentionCount: number;
  mentionRate: number;
  firstCount: number;
  firstRate: number;
  avgOrder: number | null;
  avgListPosition: number | null;
  uniqueDomainCount: number;
  sov: SovItem[];
  tagMetrics: TagMetric[];
  domainStats: DomainStat[];
  channelDistribution: ChannelStat[];
  ownershipDistribution: ChannelStat[];
  ownedDomain: {
    present: boolean;
    probeCount: number;
    rate: number;
    bestRank: number | null;
  };
  sourceStability: number | null;
  newDomains: string[];
  lostDomains: string[];
  answerLinkOverlap: number | null;
  inputTokens: number;
  outputTokens: number;
  webSearchRequests: number;
  avgLatencyMs: number;
  estimatedCost: number;
  insights: Insight[];
};

export type AppSettings = {
  defaultModel: string;
  maxTokens: number;
  maxUses: number;
  repeats: number;
  concurrency: number;
  customApiBase: string;
};

export type DemoProbeSource = {
  queryId: string;
  query: string;
  rank: number;
  title: string;
  url: string;
  pageAge: string | null;
};

export type DemoProbe = {
  promptIndex: number;
  repeatIndex: number;
  status: ProbeStatus;
  startedAt: string;
  finishedAt: string;
  latencyMs: number;
  answer: string;
  requestId?: string;
  stopReason?: string | null;
  queries: SearchQuery[];
  sources: DemoProbeSource[];
  usage: ProbeUsage;
  error?: ProbeError;
  attempts: number;
};

export type DemoRun = {
  name: string;
  startedAt: string;
  finishedAt: string;
  probes: DemoProbe[];
};

export type DemoData = {
  version: number;
  generatedAt: string;
  model: string;
  project: {
    name: string;
    brand: Target;
    competitors: Target[];
    locale: string;
    description?: string;
  };
  prompts: Array<{ text: string; tags: string[] }>;
  runs: DemoRun[];
};

export type ExportBundle = {
  version: number;
  exportedAt: string;
  projects: Project[];
  prompts: Prompt[];
  runs: Run[];
  probes: Probe[];
};
