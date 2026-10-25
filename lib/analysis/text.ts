export function normalizeText(input: string): string {
  return input.normalize("NFKC").toLowerCase();
}

export function isAsciiAlias(alias: string): boolean {
  return /^[\x00-\x7f]+$/.test(alias.normalize("NFKC"));
}

export type AliasRange = {
  alias: string;
  start: number;
  end: number;
};

export type MergedRange = {
  start: number;
  end: number;
  aliases: string[];
};

function isWordChar(char: string | undefined): boolean {
  return !!char && /[a-z0-9]/.test(char);
}

export function findAliasRanges(text: string, aliases: string[]): AliasRange[] {
  const ranges: AliasRange[] = [];
  for (const alias of aliases) {
    const needle = normalizeText(alias).trim();
    if (!needle) continue;

    let from = 0;
    while (from <= text.length) {
      const index = text.indexOf(needle, from);
      if (index === -1) break;

      const before = index > 0 ? text[index - 1] : undefined;
      const after = text[index + needle.length];

      if (!isAsciiAlias(needle) || (!isWordChar(before) && !isWordChar(after))) {
        ranges.push({ alias, start: index, end: index + needle.length });
      }

      from = index + Math.max(needle.length, 1);
    }
  }

  return ranges.sort((a, b) => a.start - b.start || b.end - a.end);
}

export function mergeRanges(ranges: AliasRange[]): MergedRange[] {
  const merged: MergedRange[] = [];
  for (const range of ranges) {
    const last = merged[merged.length - 1];
    if (last && range.start < last.end) {
      last.end = Math.max(last.end, range.end);
      if (!last.aliases.includes(range.alias)) last.aliases.push(range.alias);
    } else {
      merged.push({
        start: range.start,
        end: range.end,
        aliases: [range.alias],
      });
    }
  }
  return merged;
}

export function extractContext(
  text: string,
  start: number,
  end: number,
  radius = 80,
): string {
  const from = Math.max(0, start - radius);
  const to = Math.min(text.length, end + radius);
  const slice = text.slice(from, to).replace(/\s+/g, " ").trim();
  const prefix = from > 0 ? "…" : "";
  const suffix = to < text.length ? "…" : "";
  return `${prefix}${slice}${suffix}`;
}
