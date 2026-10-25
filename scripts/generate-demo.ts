import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import {
  DEMO_DATA_VERSION,
  MODEL_MAP,
  SYSTEM_PROMPT,
} from "../lib/config";
import { runDeepSeekProbe } from "../lib/providers/deepseek";
import type {
  DemoData,
  DemoProbe,
  DemoRun,
  ProbeError,
  ProbeUsage,
  Target,
} from "../lib/types";
import { matchTargets } from "../lib/analysis/mentions";

const MODEL = "deepseek-v4-flash";
const REPEATS = 3;
const CONCURRENCY = 3;
const BATCHES = 2;

export const BRAND: Target = {
  id: "brand",
  kind: "brand",
  label: "元构场",
  aliases: [
    "元构场",
    "元构场智能科技",
    "深圳市元构场智能科技有限公司",
    "yuangouchang",
    "yuangouchang.com",
    "GEO 标准版",
    "GEO标准版",
    "GEO 全案版",
    "GEO全案版",
    "私有化定制智能体",
    "AI 智能体建站",
  ],
  domains: ["yuangouchang.com"],
};

export const COMPETITORS: Target[] = [
  {
    id: "comp_1",
    kind: "competitor",
    label: "竞品 A",
    aliases: ["飞柚GEO", "飞柚 GEO", "深圳飞柚数智营销技术有限公司", "飞柚数智"],
    domains: ["feiyougeo.cn"],
  },
  {
    id: "comp_2",
    kind: "competitor",
    label: "竞品 B",
    aliases: ["中策大数据", "中策大数据咨询（深圳）有限公司", "中策策敏"],
    domains: [],
  },
  {
    id: "comp_3",
    kind: "competitor",
    label: "竞品 C",
    aliases: ["大鱼营销", "深圳大鱼营销有限公司", "鲸占GEO"],
    domains: [],
  },
  {
    id: "comp_4",
    kind: "competitor",
    label: "竞品 D",
    aliases: ["犀牛云GEO", "犀牛云 GEO", "深圳紫虎人工智能有限公司"],
    domains: [],
  },
  {
    id: "comp_5",
    kind: "competitor",
    label: "竞品 E",
    aliases: ["智汇Growth", "智汇 Growth", "深圳智汇蓝媒科技有限公司"],
    domains: [],
  },
];

export const PROMPTS: Array<{ text: string; tags: string[] }> = [
  { text: "推荐几家深圳做 GEO 生成式引擎优化的公司", tags: ["general"] },
  { text: "元构场GEO标准版和GEO全案版的区别", tags: ["product"] },
  { text: "元构场提供哪些 GEO 服务？", tags: ["brand"] },
  { text: "深圳 GEO 优化服务商一般怎么收费？", tags: ["general"] },
  { text: "家居建材企业怎么做 AI 搜索优化？", tags: ["industry"] },
];

export const TARGETS = [BRAND, ...COMPETITORS];

export const SENSITIVE =
  /注册资本|法定代表人|成立日期|天眼查|企查查|邓宁|5\s*万|失信|诉讼|经营异常/i;
export const NEGATIVE =
  /没有可验证|找不到|不建议|避雷|不推荐|骗|割韭菜|水分|虚假|不靠谱|风险较高/i;

function loadDotEnv(): void {
  if (process.env.DEEPSEEK_API_KEY) return;
  const envPath = path.resolve(process.cwd(), ".env");
  if (!fs.existsSync(envPath)) return;

  for (const line of fs.readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (!match) continue;
    let value = match[2].trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!process.env[match[1]]) process.env[match[1]] = value;
  }
}

function toProbeError(error: unknown): ProbeError {
  if (error instanceof Error) {
    return { message: error.message, retryable: false };
  }
  return { message: String(error), retryable: false };
}

const EMPTY_USAGE: ProbeUsage = {
  inputTokens: 0,
  outputTokens: 0,
  cacheReadTokens: 0,
  webSearchRequests: 0,
};

export async function probeOnce(
  apiKey: string,
  prompt: string,
  promptIndex: number,
  repeatIndex: number,
): Promise<DemoProbe> {
  let lastError: ProbeError | undefined;
  let attempts = 0;
  const startedAt = new Date().toISOString();
  const started = Date.now();

  for (let attempt = 1; attempt <= 3; attempt += 1) {
    attempts = attempt;
    try {
      const result = await runDeepSeekProbe({
        prompt,
        config: {
          apiKey,
          model: MODEL,
          maxTokens: 3000,
          maxUses: 5,
          systemPrompt: SYSTEM_PROMPT,
          temperature: 1,
        },
      });

      const answer = result.answer.trim();
      if (!answer) {
        lastError = { message: "空回答", retryable: true };
        continue;
      }

      const mentions = matchTargets(answer, TARGETS);
      const labels = mentions.map((mention) => `${mention.targetLabel}#${mention.order}`);
      const warnings: string[] = [];
      if (SENSITIVE.test(answer)) warnings.push("敏感信息");
      if (NEGATIVE.test(answer)) warnings.push("负面表述");

      console.error(
        `[${promptIndex + 1}.${repeatIndex}] ok ${(Date.now() - started) / 1000}s q=${result.queries.length} src=${result.sources.length} ${labels.join(",") || "无命中"}${warnings.length ? ` ⚠ ${warnings.join("/")}` : ""}`,
      );

      return {
        promptIndex,
        repeatIndex,
        status: "success",
        startedAt,
        finishedAt: new Date().toISOString(),
        latencyMs: Date.now() - started,
        answer,
        requestId: result.requestId,
        stopReason: result.stopReason ?? null,
        queries: result.queries,
        sources: result.sources,
        usage: result.usage,
        attempts,
      };
    } catch (error) {
      lastError = toProbeError(error);
      if (attempt < 3) {
        await new Promise((resolve) => setTimeout(resolve, 1000 * attempt));
      }
    }
  }

  console.error(`[${promptIndex + 1}.${repeatIndex}] failed: ${lastError?.message}`);
  return {
    promptIndex,
    repeatIndex,
    status: "error",
    startedAt,
    finishedAt: new Date().toISOString(),
    latencyMs: Date.now() - started,
    answer: "",
    queries: [],
    sources: [],
    usage: EMPTY_USAGE,
    error: lastError,
    attempts,
  };
}

async function runBatch(apiKey: string, name: string): Promise<DemoRun> {
  const startedAt = new Date().toISOString();
  const tasks: Array<{ promptIndex: number; repeatIndex: number; prompt: string }> = [];
  for (let promptIndex = 0; promptIndex < PROMPTS.length; promptIndex += 1) {
    for (let repeatIndex = 1; repeatIndex <= REPEATS; repeatIndex += 1) {
      tasks.push({ promptIndex, repeatIndex, prompt: PROMPTS[promptIndex].text });
    }
  }

  const results = new Array<DemoProbe>(tasks.length);
  let cursor = 0;

  const worker = async () => {
    while (cursor < tasks.length) {
      const index = cursor;
      cursor += 1;
      const task = tasks[index];
      results[index] = await probeOnce(apiKey, task.prompt, task.promptIndex, task.repeatIndex);
    }
  };

  console.error(`\n=== ${name} ===`);
  await Promise.all(Array.from({ length: CONCURRENCY }, () => worker()));

  return {
    name,
    startedAt,
    finishedAt: new Date().toISOString(),
    probes: results,
  };
}

async function main() {
  loadDotEnv();
  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) {
    console.error("缺少 DEEPSEEK_API_KEY。请在 .env 或环境变量中设置。");
    process.exit(1);
  }

  const runs: DemoRun[] = [];
  for (let index = 0; index < BATCHES; index += 1) {
    const label = index === 0 ? "示例批次 A" : "示例批次 B";
    runs.push(await runBatch(apiKey, label));
  }

  const data: DemoData = {
    version: DEMO_DATA_VERSION,
    generatedAt: new Date().toISOString(),
    model: MODEL,
    project: {
      name: "元构场 GEO 优化前基线",
      brand: BRAND,
      competitors: COMPETITORS,
      locale: "zh-CN",
      description: "示例数据：元构场的一次真实探测快照，非实时结果，不构成对任何公司的评价。",
    },
    prompts: PROMPTS,
    runs,
  };

  const outDir = path.resolve(process.cwd(), "public/demo");
  fs.mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, "demo-data.json");
  fs.writeFileSync(outPath, JSON.stringify(data, null, 2));

  const probes = runs.flatMap((run) => run.probes);
  const successful = probes.filter((probe) => probe.status === "success");
  const inputTokens = successful.reduce((sum, probe) => sum + probe.usage.inputTokens, 0);
  const outputTokens = successful.reduce((sum, probe) => sum + probe.usage.outputTokens, 0);
  const searches = successful.reduce((sum, probe) => sum + probe.usage.webSearchRequests, 0);
  const prices = MODEL_MAP[MODEL];
  const cost =
    (inputTokens / 1_000_000) * prices.inputPerMillion +
    (outputTokens / 1_000_000) * prices.outputPerMillion +
    searches * prices.searchPerCall;

  console.log("\n=== SUMMARY ===");
  console.log(`probes=${probes.length} ok=${successful.length} failed=${probes.length - successful.length}`);
  console.log(`tokens in=${inputTokens} out=${outputTokens} searches=${searches}`);
  console.log(`estimated cost (peak upper bound)=$${cost.toFixed(3)}`);
  console.log(`written: ${outPath}`);

  for (let index = 0; index < PROMPTS.length; index += 1) {
    const group = successful.filter((probe) => probe.promptIndex === index);
    const mentioned = group.filter(
      (probe) => matchTargets(probe.answer, TARGETS).some((mention) => mention.targetId === BRAND.id),
    );
    console.log(
      `P${index + 1} ${mentioned.length}/${group.length} | ${PROMPTS[index].text}`,
    );
  }

  const flagged = successful.filter(
    (probe) => SENSITIVE.test(probe.answer) || NEGATIVE.test(probe.answer),
  );
  if (flagged.length) {
    console.log("\n=== REVIEW FLAGS ===");
    for (const probe of flagged) {
      console.log(
        `P${probe.promptIndex + 1}.${probe.repeatIndex} | ${probe.answer.slice(0, 160).replace(/\n/g, " ")}`,
      );
    }
  }

  if (probes.length !== successful.length) {
    process.exitCode = 1;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
