import type { Probe, Project, Prompt, Run } from "@/lib/types";
import { newId, nowIso } from "@/lib/utils/id";
import { getDb } from "./index";
import { deleteSetting, setSetting } from "./settings";

export async function listProjects(): Promise<Project[]> {
  const projects = await getDb().projects.toArray();
  return projects.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export async function getProject(id: string): Promise<Project | undefined> {
  return getDb().projects.get(id);
}

export async function createProject(
  input: Omit<Project, "id" | "createdAt" | "updatedAt"> & { id?: string },
): Promise<Project> {
  const now = nowIso();
  const project: Project = {
    ...input,
    id: input.id ?? newId("prj"),
    createdAt: now,
    updatedAt: now,
  };
  await getDb().projects.add(project);
  return project;
}

export async function updateProject(
  id: string,
  patch: Partial<Omit<Project, "id" | "createdAt">>,
): Promise<void> {
  await getDb().projects.update(id, { ...patch, updatedAt: nowIso() });
}

export async function deleteProject(id: string): Promise<void> {
  const db = getDb();
  await db.transaction("rw", db.projects, db.prompts, db.runs, db.probes, async () => {
    await db.probes.where("projectId").equals(id).delete();
    await db.prompts.where("projectId").equals(id).delete();
    await db.runs.where("projectId").equals(id).delete();
    await db.projects.delete(id);
  });
}

export async function listPrompts(projectId: string): Promise<Prompt[]> {
  return getDb().prompts.where("projectId").equals(projectId).sortBy("createdAt");
}

export async function getPrompt(id: string): Promise<Prompt | undefined> {
  return getDb().prompts.get(id);
}

export async function createPrompt(
  input: Omit<Prompt, "id" | "createdAt" | "updatedAt"> & { id?: string },
): Promise<Prompt> {
  const now = nowIso();
  const prompt: Prompt = {
    ...input,
    id: input.id ?? newId("prm"),
    createdAt: now,
    updatedAt: now,
  };
  await getDb().prompts.add(prompt);
  return prompt;
}

export async function updatePrompt(
  id: string,
  patch: Partial<Omit<Prompt, "id" | "projectId" | "createdAt">>,
): Promise<void> {
  await getDb().prompts.update(id, { ...patch, updatedAt: nowIso() });
}

export async function deletePrompt(id: string): Promise<void> {
  await getDb().prompts.delete(id);
}

export async function listRuns(projectId: string): Promise<Run[]> {
  const runs = await getDb().runs.where("projectId").equals(projectId).sortBy("createdAt");
  return runs.reverse();
}

export async function getRun(id: string): Promise<Run | undefined> {
  return getDb().runs.get(id);
}

export async function createRun(
  input: Omit<Run, "id" | "createdAt"> & { id?: string },
): Promise<Run> {
  const run: Run = {
    ...input,
    id: input.id ?? newId("run"),
    createdAt: nowIso(),
  };
  await getDb().runs.add(run);
  return run;
}

export async function updateRun(id: string, patch: Partial<Omit<Run, "id">>): Promise<void> {
  await getDb().runs.update(id, patch);
}

export async function deleteRun(id: string): Promise<void> {
  const db = getDb();
  await db.transaction("rw", db.runs, db.probes, async () => {
    await db.probes.where("runId").equals(id).delete();
    await db.runs.delete(id);
  });
}

export async function listProbes(runId: string): Promise<Probe[]> {
  return getDb().probes.where("runId").equals(runId).sortBy("createdAt");
}

export async function listProjectProbes(projectId: string): Promise<Probe[]> {
  return getDb().probes.where("projectId").equals(projectId).sortBy("createdAt");
}

export async function getProbe(id: string): Promise<Probe | undefined> {
  return getDb().probes.get(id);
}

export async function createProbe(probe: Probe): Promise<void> {
  await getDb().probes.put(probe);
}

export async function updateProbe(id: string, patch: Partial<Omit<Probe, "id">>): Promise<void> {
  await getDb().probes.update(id, patch);
}

export async function getLatestCompletedRun(
  projectId: string,
  beforeCreatedAt?: string,
): Promise<Run | undefined> {
  const runs = await getDb()
    .runs.where("projectId")
    .equals(projectId)
    .filter(
      (run) =>
        (run.status === "completed" || run.status === "partial") &&
        (!beforeCreatedAt || run.createdAt < beforeCreatedAt),
    )
    .sortBy("createdAt");
  return runs[runs.length - 1];
}

export async function clearUserData(): Promise<void> {
  const db = getDb();
  await db.transaction("rw", db.projects, db.prompts, db.runs, db.probes, async () => {
    await db.probes.clear();
    await db.runs.clear();
    await db.prompts.clear();
    await db.projects.clear();
  });
  await deleteSetting("demo-seeded");
  await setSetting("demo-deleted", true);
}

export async function markDemoDeleted(): Promise<void> {
  await setSetting("demo-deleted", true);
}
