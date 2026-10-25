import Dexie, { type Table } from "dexie";
import type { Probe, Project, Prompt, Run } from "@/lib/types";

export type SettingRecord = {
  key: string;
  value: unknown;
};

export class GeoProbeDB extends Dexie {
  projects!: Table<Project, string>;
  prompts!: Table<Prompt, string>;
  runs!: Table<Run, string>;
  probes!: Table<Probe, string>;
  settings!: Table<SettingRecord, string>;

  constructor() {
    super("geo-probe");
    this.version(1).stores({
      projects: "id, updatedAt",
      prompts: "id, projectId, createdAt, updatedAt",
      runs: "id, projectId, createdAt, status",
      probes: "id, runId, projectId, promptId, status, createdAt",
      settings: "key",
    });
  }
}

let instance: GeoProbeDB | null = null;

export function getDb(): GeoProbeDB {
  if (!instance) instance = new GeoProbeDB();
  return instance;
}
