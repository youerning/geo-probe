import { DEFAULT_RUN_CONFIG, DEMO_DATA_URL, SCHEMA_VERSION, APP_VERSION } from "@/lib/config";
import { getDb } from "@/lib/db";
import { getSetting, setSetting } from "@/lib/db/settings";
import { deleteProject, listProjects } from "@/lib/db/repositories";
import type {
  DemoData,
  Probe,
  Project,
  Prompt,
  Run,
  Target,
} from "@/lib/types";
import { attachListPositions, matchTargets, parseListItems } from "@/lib/analysis/mentions";
import { extractAnswerLinks, normalizeSources } from "@/lib/analysis/sources";

const DEMO_PROJECT_ID = "demo-project";
const DEMO_SEEDED_KEY = "demo-seeded";
const DEMO_DELETED_KEY = "demo-deleted";

let seedPromise: Promise<Project | null> | null = null;

export async function fetchDemoData(): Promise<DemoData | null> {
  try {
    const response = await fetch(DEMO_DATA_URL, { cache: "no-store" });
    if (!response.ok) return null;
    return (await response.json()) as DemoData;
  } catch {
    return null;
  }
}

function targetsOf(data: DemoData): Target[] {
  return [data.project.brand, ...data.project.competitors];
}

export async function seedDemoProject(data: DemoData): Promise<Project> {
  const db = getDb();
  const now = new Date().toISOString();
  const targets = targetsOf(data);

  const project: Project = {
    id: DEMO_PROJECT_ID,
    name: data.project.name,
    brand: data.project.brand,
    competitors: data.project.competitors,
    locale: data.project.locale,
    isDemo: true,
    description: data.project.description,
    createdAt: data.generatedAt || now,
    updatedAt: now,
  };

  const prompts: Prompt[] = data.prompts.map((prompt, index) => ({
    id: `demo-prompt-${index + 1}`,
    projectId: project.id,
    text: prompt.text,
    tags: prompt.tags,
    enabled: true,
    note: "示例数据",
    createdAt: data.generatedAt || now,
    updatedAt: data.generatedAt || now,
  }));

  const runs: Run[] = data.runs.map((run, index) => ({
    id: `demo-run-${index + 1}`,
    projectId: project.id,
    name: run.name,
    status: "completed",
    config: {
      ...DEFAULT_RUN_CONFIG,
      model: data.model,
      repeats: 3,
      concurrency: 2,
      endpoint: "https://api.deepseek.com/anthropic/v1/messages",
    },
    aliasSnapshot: targets,
    promptSnapshot: prompts.map((prompt) => ({
      id: prompt.id,
      text: prompt.text,
      tags: prompt.tags,
    })),
    previousRunId: index > 0 ? `demo-run-${index}` : undefined,
    plannedProbeCount: run.probes.length,
    startedAt: run.startedAt,
    finishedAt: run.finishedAt,
    createdAt: run.startedAt,
    note: "示例数据，非实时结果",
    appVersion: APP_VERSION,
    schemaVersion: SCHEMA_VERSION,
  }));

  const probes: Probe[] = [];

  data.runs.forEach((run, runIndex) => {
    run.probes.forEach((probe) => {
      const prompt = prompts[probe.promptIndex];
      if (!prompt) return;
      const runId = `demo-run-${runIndex + 1}`;
      const sources = normalizeSources(
        probe.sources.map((source) => ({
          queryId: source.queryId,
          query: source.query,
          rank: source.rank,
          title: source.title,
          url: source.url,
          pageAge: source.pageAge,
        })),
        targets,
      );
      const mentions = matchTargets(probe.answer, targets);
      const { items, otherEntities } = parseListItems(probe.answer, targets);
      attachListPositions(mentions, items);
      const answerLinks = extractAnswerLinks(probe.answer, targets, sources);

      probes.push({
        id: `${runId}__${prompt.id}__${probe.repeatIndex}`,
        runId,
        projectId: project.id,
        promptId: prompt.id,
        promptText: prompt.text,
        promptTags: prompt.tags,
        repeatIndex: probe.repeatIndex,
        status: probe.status,
        startedAt: probe.startedAt,
        finishedAt: probe.finishedAt,
        latencyMs: probe.latencyMs,
        model: data.model,
        requestId: probe.requestId,
        stopReason: probe.stopReason ?? null,
        answer: probe.answer,
        answerChars: probe.answer.length,
        answerLinks,
        queries: probe.queries,
        sources,
        mentions,
        listItems: items,
        otherEntities,
        usage: probe.usage,
        error: probe.error,
        attempts: probe.attempts,
        createdAt: probe.startedAt,
      });
    });
  });

  await db.transaction("rw", db.projects, db.prompts, db.runs, db.probes, db.settings, async () => {
    await db.projects.put(project);
    await db.prompts.bulkPut(prompts);
    await db.runs.bulkPut(runs);
    await db.probes.bulkPut(probes);
    await db.settings.put({ key: DEMO_SEEDED_KEY, value: true });
    await db.settings.delete(DEMO_DELETED_KEY);
  });

  return project;
}

export async function ensureDemoSeed(): Promise<Project | null> {
  if (seedPromise) return seedPromise;

  seedPromise = (async () => {
    const deleted = await getSetting<boolean>(DEMO_DELETED_KEY, false);
    if (deleted) return null;

    const projects = await listProjects();
    const existing = projects.find((project) => project.isDemo);
    if (existing) return existing;

    const seeded = await getSetting<boolean>(DEMO_SEEDED_KEY, false);
    if (seeded) return null;

    const data = await fetchDemoData();
    if (!data) return null;
    return seedDemoProject(data);
  })();

  try {
    return await seedPromise;
  } finally {
    seedPromise = null;
  }
}

export async function restoreDemo(): Promise<Project | null> {
  const projects = await listProjects();
  for (const project of projects) {
    if (project.isDemo) await deleteProject(project.id);
  }
  await setSetting(DEMO_DELETED_KEY, false);
  await setSetting(DEMO_SEEDED_KEY, false);
  const data = await fetchDemoData();
  if (!data) return null;
  return seedDemoProject(data);
}

export async function deleteDemo(): Promise<void> {
  const projects = await listProjects();
  for (const project of projects) {
    if (project.isDemo) await deleteProject(project.id);
  }
  await setSetting(DEMO_DELETED_KEY, true);
  await setSetting(DEMO_SEEDED_KEY, false);
}
