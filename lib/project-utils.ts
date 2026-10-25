import type { Target } from "@/lib/types";
import { uniq } from "@/lib/utils/array";

export function splitList(value?: string | null): string[] {
  if (!value) return [];
  return uniq(
    value
      .split(/[\n,，、;；]+/)
      .map((item) => item.trim())
      .filter(Boolean),
  );
}

export function parseCompetitors(value: string): Target[] {
  return value
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, 5)
    .map((line, index) => {
      const [rawLabel, rawAliases, rawDomains] = line.split("|").map((part) => part?.trim() ?? "");
      const label = rawLabel || `竞品 ${String.fromCharCode(65 + index)}`;
      return {
        id: `comp_${index + 1}`,
        kind: "competitor" as const,
        label,
        aliases: uniq([label, ...splitList(rawAliases)]),
        domains: splitList(rawDomains),
      };
    });
}

export function formatCompetitors(competitors: Target[]): string {
  return competitors
    .map((competitor) => `${competitor.label} | ${competitor.aliases.join(", ")} | ${competitor.domains.join(", ")}`)
    .join("\n");
}

export function buildBrandTarget(label: string, aliases: string, domains: string): Target {
  return {
    id: "brand",
    kind: "brand",
    label: label.trim(),
    aliases: uniq([label.trim(), ...splitList(aliases)]),
    domains: splitList(domains),
  };
}
