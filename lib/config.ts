import type { AppSettings, RunConfig, SourceChannel, SourceOwnership } from "@/lib/types";

export const APP_NAME = "GEO Probe";
export const APP_VERSION = "0.1.0";
export const SCHEMA_VERSION = 1;
export const DEMO_DATA_VERSION = 1;

export const GITHUB_URL = "https://github.com/youerning/geo-probe";
export const DEMO_URL = "https://geo-probe.youerning.top";
export const COMPANY_URL = "https://www.yuangouchang.com";
export const COMPANY_NAME = "深圳市元构场智能科技有限公司";

export const API_BASE_URL = "https://api.deepseek.com";
export const ANTHROPIC_VERSION = "2023-06-01";
export const DEFAULT_MODEL = "deepseek-v4-flash";

export const SYSTEM_PROMPT =
  "你是一个乐于助人的助手。请直接回答用户问题，不要描述你的搜索或思考过程。";
export const SYSTEM_PROMPT_VERSION = "v1-neutral";

export const RECOMMENDED_PROMPT_MIN = 10;
export const RECOMMENDED_PROMPT_MAX = 20;
export const MAX_PROMPT_COUNT = 50;

export const DEFAULT_RUN_CONFIG: Omit<RunConfig, "endpoint"> = {
  model: DEFAULT_MODEL,
  maxTokens: 3000,
  maxUses: 5,
  systemPrompt: SYSTEM_PROMPT,
  systemPromptVersion: SYSTEM_PROMPT_VERSION,
  temperature: 1,
  thinking: "default",
  repeats: 3,
  concurrency: 2,
};

export const DEFAULT_SETTINGS: AppSettings = {
  defaultModel: DEFAULT_MODEL,
  maxTokens: 3000,
  maxUses: 5,
  repeats: 3,
  concurrency: 2,
  customApiBase: "",
};

export type ModelOption = {
  value: string;
  label: string;
  shortLabel: string;
  description: string;
  inputPerMillion: number;
  outputPerMillion: number;
  searchPerCall: number;
};

export const MODEL_OPTIONS: ModelOption[] = [
  {
    value: "deepseek-v4-flash",
    label: "DeepSeek V4 Flash",
    shortLabel: "V4 Flash",
    description: "默认。速度快、成本低，支持联网搜索，适合批量探测。",
    inputPerMillion: 0.3,
    outputPerMillion: 1.2,
    searchPerCall: 0.00075,
  },
  {
    value: "deepseek-v4-pro",
    label: "DeepSeek V4 Pro",
    shortLabel: "V4 Pro",
    description: "更强推理，成本约为 Flash 的 4 倍。遇到 Flash 搜索异常时可切换。",
    inputPerMillion: 1.32,
    outputPerMillion: 3.96,
    searchPerCall: 0.00075,
  },
];

export const MODEL_MAP = Object.fromEntries(
  MODEL_OPTIONS.map((model) => [model.value, model]),
) as Record<string, ModelOption>;

export const PROMPT_TAGS = [
  {
    value: "general",
    label: "通用词",
    description: "不带品牌的品类词、推荐词，例如“深圳 GEO 公司推荐”",
    badgeClass: "bg-chart-1/15 text-chart-1 border-chart-1/20",
    dotClass: "bg-chart-1",
  },
  {
    value: "brand",
    label: "品牌词",
    description: "直接搜索品牌名，例如“元构场怎么样”",
    badgeClass: "bg-chart-2/15 text-chart-2 border-chart-2/20",
    dotClass: "bg-chart-2",
  },
  {
    value: "product",
    label: "产品词",
    description: "搜索具体产品或套餐，例如“GEO 标准版和全案版区别”",
    badgeClass: "bg-chart-3/15 text-chart-3 border-chart-3/20",
    dotClass: "bg-chart-3",
  },
  {
    value: "local",
    label: "本地词",
    description: "带地域的搜索，例如“深圳龙华 AI 搜索优化”",
    badgeClass: "bg-chart-4/15 text-chart-4 border-chart-4/20",
    dotClass: "bg-chart-4",
  },
  {
    value: "competitor",
    label: "竞品词",
    description: "对比或替代类搜索，例如“飞柚GEO 和 元构场 哪个好”",
    badgeClass: "bg-chart-5/15 text-chart-5 border-chart-5/20",
    dotClass: "bg-chart-5",
  },
  {
    value: "industry",
    label: "行业词",
    description: "行业 + 场景，例如“东莞家居建材企业怎么做 GEO”",
    badgeClass: "bg-muted text-muted-foreground border-border",
    dotClass: "bg-muted-foreground",
  },
] as const;

export const PROMPT_TAG_MAP = Object.fromEntries(
  PROMPT_TAGS.map((tag) => [tag.value, tag]),
) as Record<string, (typeof PROMPT_TAGS)[number]>;

export const SOURCE_CHANNEL_LABELS: Record<SourceChannel, string> = {
  encyclopedia: "百科",
  social: "社交平台",
  wechat: "微信公众号",
  news: "新闻媒体",
  directory: "企业信息/目录",
  app_store: "应用商店",
  official: "政府/教育",
  other: "其他",
};

export const SOURCE_OWNERSHIP_LABELS: Record<SourceOwnership, string> = {
  owned: "自有",
  competitor: "竞品",
  third_party: "第三方",
};

export const STORAGE_KEYS = {
  apiKey: "geo-probe:api-key",
  sessionApiKey: "geo-probe:api-key:session",
  selectedProject: "geo-probe:selected-project",
  demoDeleted: "geo-probe:demo-deleted",
  demoSeeded: "geo-probe:demo-seeded",
} as const;

export const DEMO_DATA_URL = `${process.env.NEXT_PUBLIC_BASE_PATH || ""}/demo/demo-data.json`;

export const DISCLAIMER =
  "结果由 AI 模型实时生成，同一问题多次提问可能得到不同答案。检索来源只代表搜索工具返回的网页，不代表模型逐句引用。结果仅供优化参考，不构成对任何公司或产品的评价。";

export const PRIVACY_TEXT =
  "GEO Probe 是纯静态应用：没有后端、没有遥测、没有第三方统计。API Key 只保存在你的浏览器里，并直接发送给 DeepSeek；项目、提示词、回答和来源数据全部存在浏览器 IndexedDB 中。";

export const DEFAULT_PRICE_NOTE = "按 DeepSeek 峰值价估算，实际以账单为准。";
