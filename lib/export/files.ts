import Papa from "papaparse";
import type { Probe, Project, Prompt, Run } from "@/lib/types";
import { downloadCsv, downloadJson, downloadText } from "@/lib/utils/download";
import { nowIso } from "@/lib/utils/id";

export function buildExportBundle(params: {
  projects: Project[];
  prompts: Prompt[];
  runs: Run[];
  probes: Probe[];
}) {
  return {
    version: 1,
    exportedAt: nowIso(),
    ...params,
  };
}

export function downloadAllJson(params: {
  projects: Project[];
  prompts: Prompt[];
  runs: Run[];
  probes: Probe[];
}) {
  downloadJson(`geo-probe-backup-${nowIso().slice(0, 10)}.json`, buildExportBundle(params));
}

export function downloadRunJson(params: {
  run: Run;
  project?: Project;
  prompts: Prompt[];
  probes: Probe[];
}) {
  downloadJson(`geo-probe-run-${params.run.id}.json`, {
    version: 1,
    exportedAt: nowIso(),
    ...params,
  });
}

export function probesToCsv(probes: Probe[], run: Run): string {
  const brandId =
    run.aliasSnapshot.find((target) => target.kind === "brand")?.id ?? "brand";

  const rows = probes.map((probe) => {
    const mention = probe.mentions.find((item) => item.targetId === brandId);
    const domains = Array.from(
      new Set(probe.sources.map((source) => source.domain || source.host).filter(Boolean)),
    );

    return {
      run_id: probe.runId,
      run_name: run.name,
      project_id: probe.projectId,
      prompt_id: probe.promptId,
      prompt: probe.promptText,
      tags: probe.promptTags.join("|"),
      repeat: probe.repeatIndex,
      status: probe.status,
      mention: mention ? "1" : "0",
      mention_alias: mention?.alias ?? "",
      mention_order: mention?.order ?? "",
      list_position: mention?.listPosition ?? "",
      source_count: probe.sources.length,
      unique_domains: domains.length,
      domains: domains.join("|"),
      owned_domain: probe.sources.some((source) => source.ownership === "owned") ? "1" : "0",
      input_tokens: probe.usage.inputTokens,
      output_tokens: probe.usage.outputTokens,
      web_searches: probe.usage.webSearchRequests,
      latency_ms: probe.latencyMs,
      stop_reason: probe.stopReason ?? "",
      error: probe.error?.message ?? "",
      created_at: probe.createdAt,
      answer: probe.answer,
    };
  });

  return Papa.unparse(rows);
}

export function sourcesToCsv(probes: Probe[], run: Run): string {
  const rows: Record<string, string | number>[] = [];

  for (const probe of probes) {
    for (const source of probe.sources) {
      for (const occurrence of source.occurrences) {
        rows.push({
          run_id: probe.runId,
          run_name: run.name,
          probe_id: probe.id,
          prompt_id: probe.promptId,
          prompt: probe.promptText,
          repeat: probe.repeatIndex,
          query: occurrence.query,
          rank: occurrence.rank,
          title: source.title,
          url: source.url,
          canonical_url: source.canonicalUrl,
          host: source.host,
          domain: source.domain,
          platform: source.platform,
          channel: source.channel,
          ownership: source.ownership,
          page_age: source.pageAge ?? "",
        });
      }
    }
  }

  return Papa.unparse(rows);
}

export function downloadRunProbesCsv(run: Run, probes: Probe[]) {
  downloadCsv(`geo-probe-run-${run.id}-probes.csv`, probesToCsv(probes, run));
}

export function downloadRunSourcesCsv(run: Run, probes: Probe[]) {
  downloadCsv(`geo-probe-run-${run.id}-sources.csv`, sourcesToCsv(probes, run));
}

export function downloadTextFile(filename: string, content: string) {
  downloadText(filename, content, "text/markdown;charset=utf-8");
}
