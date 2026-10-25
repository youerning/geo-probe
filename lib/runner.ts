import { format } from "date-fns";
import { DEFAULT_RUN_CONFIG } from "@/lib/config";
import {
  createProbe,
  createRun,
  getLatestCompletedRun,
  getProbe,
  getRun,
  listProbes,
  updateRun,
} from "@/lib/db/repositories";
import { DeepSeekApiError, runDeepSeekProbe, type DeepSeekConfig } from "@/lib/providers/deepseek";
import type {
  Probe,
  ProbeError,
  ProbeStatus,
  Project,
  Prompt,
  Run,
  RunConfig,
} from "@/lib/types";
import { attachListPositions, matchTargets, parseListItems } from "@/lib/analysis/mentions";
import { extractAnswerLinks, normalizeSources } from "@/lib/analysis/sources";
import { APP_VERSION, SCHEMA_VERSION } from "@/lib/config";
import { newId, nowIso } from "@/lib/utils/id";

const MAX_ATTEMPTS = 3;

export type RunProgress = {
  runId: string;
  total: number;
  completed: number;
  success: number;
  error: number;
  lastProbe?: {
    promptId: string;
    repeatIndex: number;
    status: ProbeStatus;
    message?: string;
  };
};

type ProbeTask = {
  promptId: string;
  promptText: string;
  promptTags: string[];
  repeatIndex: number;
};

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function cleanAnswer(input: string): string {
  const trimmed = input.trim();
  if (!trimmed) return "";
  const paragraphs = trimmed.split(/\n{2,}/);
  if (paragraphs.length < 2) return trimmed;

  const first = paragraphs[0].trim();
  const looksLikePlanning =
    first.length < 400 &&
    /^(i'll|i will|let me|let's|i'm going to|i am going to|我先|让我|我会|我来)/i.test(first) &&
    /(search|look up|check|查询|搜索|检索)/i.test(first);

  if (looksLikePlanning) {
    return paragraphs.slice(1).join("\n\n").trim();
  }
  return trimmed;
}

function toProbeError(error: unknown): ProbeError {
  if (error instanceof DeepSeekApiError) {
    return {
      message: error.message,
      code: error.code,
      retryable: error.retryable,
    };
  }
  if (error instanceof Error) {
    return { message: error.message, retryable: false };
  }
  return { message: String(error), retryable: false };
}

function emptyUsage() {
  return { inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, webSearchRequests: 0 };
}

function buildProbe(params: {
  run: Run;
  task: ProbeTask;
  status: ProbeStatus;
  startedAt: string;
  latencyMs: number;
  attempts: number;
  result?: Awaited<ReturnType<typeof runDeepSeekProbe>>;
  error?: ProbeError;
}): Probe {
  const { run, task, status, startedAt, latencyMs, attempts, result, error } = params;
  const answer = result?.answer ?? "";
  const sources = result ? normalizeSources(result.sources, run.aliasSnapshot) : [];
  const mentions = result ? matchTargets(answer, run.aliasSnapshot) : [];
  const { items, otherEntities } = result
    ? parseListItems(answer, run.aliasSnapshot)
    : { items: [], otherEntities: [] };
  attachListPositions(mentions, items);
  const answerLinks = result
    ? extractAnswerLinks(answer, run.aliasSnapshot, sources)
    : [];

  return {
    id: `${run.id}__${task.promptId}__${task.repeatIndex}`,
    runId: run.id,
    projectId: run.projectId,
    promptId: task.promptId,
    promptText: task.promptText,
    promptTags: task.promptTags,
    repeatIndex: task.repeatIndex,
    status,
    startedAt,
    finishedAt: nowIso(),
    latencyMs,
    model: result?.model ?? run.config.model,
    requestId: result?.requestId,
    stopReason: result?.stopReason ?? null,
    answer,
    answerChars: answer.length,
    answerLinks,
    queries: result?.queries ?? [],
    sources,
    mentions,
    listItems: items,
    otherEntities,
    usage: result?.usage ?? emptyUsage(),
    error,
    attempts,
    createdAt: nowIso(),
  };
}

async function executeProbe(params: {
  run: Run;
  task: ProbeTask;
  config: RunConfig;
  apiKey: string;
  baseUrl?: string;
  signal?: AbortSignal;
}): Promise<Probe> {
  const { run, task, config, apiKey, baseUrl, signal } = params;
  const startedAt = nowIso();
  const started = Date.now();
  let lastError: ProbeError | undefined;
  let attempts = 0;

  const providerConfig: DeepSeekConfig = {
    apiKey,
    baseUrl,
    model: config.model,
    maxTokens: config.maxTokens,
    maxUses: config.maxUses,
    systemPrompt: config.systemPrompt,
    temperature: config.temperature,
  };

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    attempts = attempt;

    if (signal?.aborted) {
      throw new DOMException("Aborted", "AbortError");
    }

    try {
      const result = await runDeepSeekProbe({
        prompt: task.promptText,
        config: providerConfig,
        signal,
      });

      const answer = cleanAnswer(result.answer);

      if (!answer) {
        lastError = {
          message: "模型没有返回最终回答（空回答）。",
          code: "empty_answer",
          retryable: true,
        };
        if (attempt < MAX_ATTEMPTS) {
          await sleep(900 * attempt);
          continue;
        }
        return buildProbe({
          run,
          task,
          status: "empty",
          startedAt,
          latencyMs: Date.now() - started,
          attempts,
          result: { ...result, answer },
          error: lastError,
        });
      }

      return buildProbe({
        run,
        task,
        status: "success",
        startedAt,
        latencyMs: Date.now() - started,
        attempts,
        result: { ...result, answer },
      });
    } catch (error) {
      if (signal?.aborted) throw error;
      lastError = toProbeError(error);
      const retryable =
        error instanceof DeepSeekApiError ? error.retryable : lastError.retryable === true;

      if (!retryable || attempt >= MAX_ATTEMPTS) break;
      await sleep(1200 * attempt + Math.floor(Math.random() * 400));
    }
  }

  return buildProbe({
    run,
    task,
    status: "error",
    startedAt,
    latencyMs: Date.now() - started,
    attempts,
    error: lastError ?? { message: "未知错误", retryable: false },
  });
}

function buildTasks(prompts: Array<Pick<Prompt, "id" | "text" | "tags">>, repeats: number): ProbeTask[] {
  const tasks: ProbeTask[] = [];
  for (const prompt of prompts) {
    for (let repeatIndex = 1; repeatIndex <= repeats; repeatIndex += 1) {
      tasks.push({
        promptId: prompt.id,
        promptText: prompt.text,
        promptTags: prompt.tags,
        repeatIndex,
      });
    }
  }
  return tasks;
}

async function runTasks(params: {
  run: Run;
  tasks: ProbeTask[];
  config: RunConfig;
  apiKey: string;
  baseUrl?: string;
  concurrency: number;
  signal?: AbortSignal;
  onProgress?: (progress: RunProgress) => void;
}): Promise<{ success: number; error: number; completed: number; cancelled: boolean }> {
  const { run, tasks, config, apiKey, baseUrl, concurrency, signal, onProgress } = params;
  const total = tasks.length;
  let completed = 0;
  let success = 0;
  let error = 0;
  let cancelled = false;
  let cursor = 0;

  const report = (lastProbe?: RunProgress["lastProbe"]) => {
    onProgress?.({
      runId: run.id,
      total,
      completed,
      success,
      error,
      lastProbe,
    });
  };

  report();

  const worker = async () => {
    while (cursor < tasks.length) {
      if (signal?.aborted) {
        cancelled = true;
        return;
      }

      const index = cursor;
      cursor += 1;
      const task = tasks[index];

      try {
        const probe = await executeProbe({
          run,
          task,
          config,
          apiKey,
          baseUrl,
          signal,
        });
        await createProbe(probe);
        completed += 1;
        if (probe.status === "success") success += 1;
        else error += 1;
        report({
          promptId: task.promptId,
          repeatIndex: task.repeatIndex,
          status: probe.status,
          message: probe.error?.message,
        });
      } catch (caught) {
        if (caught instanceof DOMException && caught.name === "AbortError") {
          cancelled = true;
          return;
        }
        completed += 1;
        error += 1;
        report({
          promptId: task.promptId,
          repeatIndex: task.repeatIndex,
          status: "error",
          message: caught instanceof Error ? caught.message : String(caught),
        });
      }
    }
  };

  await Promise.all(
    Array.from({ length: Math.max(1, Math.min(concurrency, 3)) }, () => worker()),
  );

  return { success, error, completed, cancelled };
}

export async function startRun(params: {
  project: Project;
  prompts: Prompt[];
  config: RunConfig;
  apiKey: string;
  baseUrl?: string;
  repeats?: number;
  concurrency?: number;
  name?: string;
  signal?: AbortSignal;
  onProgress?: (progress: RunProgress) => void;
}): Promise<{ run: Run; probes: Probe[] }> {
  const { project, prompts, config, apiKey, baseUrl, signal, onProgress } = params;
  if (!prompts.length) throw new Error("至少选择一条提示词。");

  const repeats = params.repeats ?? config.repeats ?? DEFAULT_RUN_CONFIG.repeats;
  const concurrency = params.concurrency ?? config.concurrency ?? DEFAULT_RUN_CONFIG.concurrency;
  const previousRun = await getLatestCompletedRun(project.id);

  const run = await createRun({
    projectId: project.id,
    name: params.name?.trim() || `批次 ${format(new Date(), "MM-dd HH:mm")}`,
    status: "running",
    config: {
      ...config,
      repeats,
      concurrency,
      endpoint: basenameUrl(baseUrl),
    },
    aliasSnapshot: [project.brand, ...project.competitors],
    promptSnapshot: prompts.map((prompt) => ({
      id: prompt.id,
      text: prompt.text,
      tags: prompt.tags,
    })),
    previousRunId: previousRun?.id,
    plannedProbeCount: prompts.length * repeats,
    startedAt: nowIso(),
    appVersion: APP_VERSION,
    schemaVersion: SCHEMA_VERSION,
  });

  const tasks = buildTasks(prompts, repeats);
  let outcome: { success: number; error: number; completed: number; cancelled: boolean };
  try {
    outcome = await runTasks({
      run,
      tasks,
      config: { ...config, repeats, concurrency },
      apiKey,
      baseUrl,
      concurrency,
      signal,
      onProgress,
    });
  } catch (error) {
    await updateRun(run.id, { status: "failed", finishedAt: nowIso() });
    throw error;
  }

  const status = outcome.cancelled
    ? "cancelled"
    : outcome.error > 0
      ? outcome.success > 0
        ? "partial"
        : "failed"
      : "completed";

  await updateRun(run.id, { status, finishedAt: nowIso() });
  const updated = (await getRun(run.id)) ?? run;
  const probes = await listProbes(run.id);

  return { run: updated, probes };
}

export async function resumeRun(params: {
  runId: string;
  apiKey: string;
  baseUrl?: string;
  signal?: AbortSignal;
  onProgress?: (progress: RunProgress) => void;
}): Promise<{ run: Run; probes: Probe[] } | null> {
  const { runId, apiKey, baseUrl, signal, onProgress } = params;
  const run = await getRun(runId);
  if (!run) return null;

  const existing = await listProbes(runId);
  const succeeded = new Set(
    existing.filter((probe) => probe.status === "success").map((probe) => probe.id),
  );

  const allTasks = buildTasks(
    run.promptSnapshot.map((prompt) => ({
      id: prompt.id,
      text: prompt.text,
      tags: prompt.tags,
    })),
    run.config.repeats,
  );

  const tasks = allTasks.filter(
    (task) => !succeeded.has(`${run.id}__${task.promptId}__${task.repeatIndex}`),
  );

  if (!tasks.length) {
    return { run, probes: existing };
  }

  await updateRun(run.id, { status: "running", finishedAt: undefined });

  let outcome: { success: number; error: number; completed: number; cancelled: boolean };
  try {
    outcome = await runTasks({
      run,
      tasks,
      config: run.config,
      apiKey,
      baseUrl,
      concurrency: run.config.concurrency,
      signal,
      onProgress,
    });
  } catch (error) {
    await updateRun(run.id, { status: "failed", finishedAt: nowIso() });
    throw error;
  }

  const status = outcome.cancelled
    ? "cancelled"
    : outcome.error > 0
      ? outcome.success > 0
        ? "partial"
        : "failed"
      : "completed";

  await updateRun(run.id, { status, finishedAt: nowIso() });
  const updated = (await getRun(run.id)) ?? run;
  const probes = await listProbes(run.id);

  return { run: updated, probes };
}

function basenameUrl(baseUrl?: string): string {
  const base = (baseUrl?.trim() || "https://api.deepseek.com").replace(/\/+$/, "");
  return `${base}/anthropic/v1/messages`;
}

export async function retryFailedProbes(params: {
  runId: string;
  apiKey: string;
  baseUrl?: string;
  signal?: AbortSignal;
  onProgress?: (progress: RunProgress) => void;
}): Promise<{ run: Run; probes: Probe[] } | null> {
  const run = await getRun(params.runId);
  if (!run) return null;
  const probes = await listProbes(run.id);
  const failedIds = probes
    .filter((probe) => probe.status === "error" || probe.status === "empty")
    .map((probe) => probe.id);

  if (!failedIds.length) return { run, probes };

  const promptMap = new Map(run.promptSnapshot.map((prompt) => [prompt.id, prompt]));

  for (const id of failedIds) {
    const probe = await getProbe(id);
    if (!probe) continue;
    const prompt = promptMap.get(probe.promptId);
    if (!prompt) continue;

    const task: ProbeTask = {
      promptId: prompt.id,
      promptText: prompt.text,
      promptTags: prompt.tags,
      repeatIndex: probe.repeatIndex,
    };

    try {
      const next = await executeProbe({
        run,
        task,
        config: run.config,
        apiKey: params.apiKey,
        baseUrl: params.baseUrl,
        signal: params.signal,
      });
      await createProbe(next);
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") break;
      throw error;
    }
  }

  const finalProbes = await listProbes(run.id);
  const hasError = finalProbes.some(
    (probe) => probe.status === "error" || probe.status === "empty",
  );
  await updateRun(run.id, {
    status: hasError ? "partial" : "completed",
    finishedAt: nowIso(),
  });

  return { run: (await getRun(run.id)) ?? run, probes: finalProbes };
}

export function createRunName(): string {
  return `批次 ${format(new Date(), "MM-dd HH:mm")}`;
}

export function makeRunId(): string {
  return newId("run");
}
