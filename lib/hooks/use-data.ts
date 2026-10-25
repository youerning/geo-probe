"use client";

import { useLiveQuery } from "dexie-react-hooks";
import {
  getProject,
  getRun,
  listProjectProbes,
  listProjects,
  listPrompts,
  listProbes,
  listRuns,
} from "@/lib/db/repositories";

export function useProjects() {
  return useLiveQuery(() => listProjects(), []);
}

export function useProject(id: string | null | undefined) {
  return useLiveQuery(async () => (id ? getProject(id) : undefined), [id]);
}

export function usePrompts(projectId: string | null | undefined) {
  return useLiveQuery(
    async () => (projectId ? listPrompts(projectId) : []),
    [projectId],
  );
}

export function useRuns(projectId: string | null | undefined) {
  return useLiveQuery(
    async () => (projectId ? listRuns(projectId) : []),
    [projectId],
  );
}

export function useRun(runId: string | null | undefined) {
  return useLiveQuery(async () => (runId ? getRun(runId) : undefined), [runId]);
}

export function useProbes(runId: string | null | undefined) {
  return useLiveQuery(
    async () => (runId ? listProbes(runId) : []),
    [runId],
  );
}

export function useProjectProbes(projectId: string | null | undefined) {
  return useLiveQuery(
    async () => (projectId ? listProjectProbes(projectId) : []),
    [projectId],
  );
}
