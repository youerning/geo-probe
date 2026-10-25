import type { Target } from "@/lib/types";
import { uniq } from "@/lib/utils/array";

export const MAX_COMPETITORS = 5;

export type CompetitorDraft = {
  label: string;
  aliases: string;
  domains: string;
};

export function splitList(value?: string | null): string[] {
  if (!value) return [];
  return uniq(
    value
      .split(/[\n,，、;；]+/)
      .map((item) => item.trim())
      .filter(Boolean),
  );
}

export function targetsToDrafts(targets: Target[]): CompetitorDraft[] {
  return targets.slice(0, MAX_COMPETITORS).map((target) => ({
    label: target.label,
    aliases: target.aliases.filter((alias) => alias !== target.label).join(", "),
    domains: target.domains.join(", "),
  }));
}

export function draftsToTargets(drafts: CompetitorDraft[]): Target[] {
  return drafts
    .map((draft) => ({ ...draft, label: draft.label.trim() }))
    .filter((draft) => draft.label.length > 0)
    .slice(0, MAX_COMPETITORS)
    .map((draft, index) => ({
      id: `comp_${index + 1}`,
      kind: "competitor" as const,
      label: draft.label,
      aliases: uniq([draft.label, ...splitList(draft.aliases)]),
      domains: splitList(draft.domains),
    }));
}

export function formatBrandAliases(brand: Target): string {
  return uniq(brand.aliases.filter((alias) => alias !== brand.label)).join("\n");
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
