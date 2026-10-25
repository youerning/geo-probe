import type { ListItem, Mention, Target } from "@/lib/types";
import { uniq } from "@/lib/utils/array";
import { extractContext, findAliasRanges, mergeRanges, normalizeText } from "./text";

export function matchTargets(text: string, targets: Target[]): Mention[] {
  if (!text.trim()) return [];

  const normalized = normalizeText(text);
  const display = text.normalize("NFKC");
  const contextSource = display.length === normalized.length ? display : normalized;
  const targetOrder = new Map(targets.map((target, index) => [target.id, index]));

  const mentions: Mention[] = [];

  for (const target of targets) {
    const ranges = findAliasRanges(normalized, target.aliases);
    if (ranges.length === 0) continue;

    const merged = mergeRanges(ranges);
    const first = merged[0];

    mentions.push({
      targetId: target.id,
      targetLabel: target.label,
      alias: first.aliases[0] ?? target.label,
      matchedAliases: uniq(merged.flatMap((range) => range.aliases)),
      count: merged.length,
      firstIndex: first.start,
      context: extractContext(contextSource, first.start, first.end),
      order: 0,
      listPosition: null,
    });
  }

  mentions.sort((a, b) => {
    if (a.firstIndex !== b.firstIndex) return a.firstIndex - b.firstIndex;
    return (targetOrder.get(a.targetId) ?? 99) - (targetOrder.get(b.targetId) ?? 99);
  });

  mentions.forEach((mention, index) => {
    mention.order = index + 1;
  });

  return mentions;
}

export function findMentionedTargets(text: string, targets: Target[]): string[] {
  return uniq(matchTargets(text, targets).map((mention) => mention.targetLabel));
}

const NUMBERED_LINE = /^\s*(?:#{1,6}\s*)?(\d{1,2})[.、)]\s+(.+?)\s*$/;
const BOLD_NUMBERED_LINE = /^\s*\*\*(\d{1,2})[.、)]\s*(.+?)\*\*\s*(.*)$/;
const BULLET_LINE = /^\s*[-*+]\s+(.+?)\s*$/;
const TABLE_ROW = /^\s*\|(.+)\|\s*$/;

const COMPANY_HINTS =
  /公司|科技|智能|营销|网络|传媒|数据|信息|集团|GEO|AI|服务|咨询|文化|电子|实业|有限|品牌|优化|推广/i;

const GENERIC_TITLES =
  /^(总结|结论|建议|注意|说明|参考|来源|优势|劣势|对比|如何|为什么|什么|步骤|方法|要点|核心|补充|背景|现状|判断|实践|案例|风险|成本|报价|价格|服务内容|适用|推荐理由|一句话)/;

type CandidateType = "numbered" | "bullet" | "bold" | "table";

type Candidate = {
  index: number;
  raw: string;
  title: string;
  body: string;
  score: number;
  type: CandidateType;
};

function cleanTitle(input: string): string {
  let title = input
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/\*\*(.*?)\*\*/g, "$1")
    .replace(/__(.*?)__/g, "$1")
    .replace(/`/g, "")
    .trim();

  const cut = title.split(/[：:]|\s[-—]\s|[（(]/)[0];
  if (cut) title = cut;

  title = title
    .replace(/^[\s\d.、)）]+/, "")
    .replace(/[。；;，,\s]+$/, "")
    .trim();

  if (title.length > 80) title = `${title.slice(0, 80)}…`;
  return title;
}

function scoreTitle(title: string, matched: boolean): number {
  let score = 0;
  if (matched) score += 5;
  if (COMPANY_HINTS.test(title)) score += 2;
  if (title.length >= 2 && title.length <= 40) score += 1;
  if (GENERIC_TITLES.test(title)) score -= 5;
  return score;
}

function parseTable(lines: string[]): Candidate[] {
  const rows = lines.filter((line) => TABLE_ROW.test(line));
  if (rows.length < 3) return [];

  const dataRows = rows.filter((line) => !/^\s*\|?[\s:|-]+\|?\s*$/.test(line));
  if (dataRows.length < 2) return [];

  const cells = dataRows.map((line) => {
    const inner = line.trim().replace(/^\|/, "").replace(/\|$/, "");
    return inner.split("|").map((cell) => cell.trim());
  });

  const first = cells[0]?.[0] ?? "";
  const start = /公司|名称|服务商|品牌|机构|企业/.test(first) ? 1 : 0;

  return cells.slice(start).map((row, index) => {
    const raw = row.join(" | ");
    const title = cleanTitle(row[0] ?? "");
    return {
      index: index + 1,
      raw,
      title,
      body: raw,
      score: 0,
      type: "table",
    };
  });
}

export function parseListItems(
  text: string,
  targets: Target[],
): { items: ListItem[]; otherEntities: string[] } {
  if (!text.trim()) return { items: [], otherEntities: [] };

  const lines = text.split(/\r?\n/);
  const groups: Candidate[][] = [];
  let current: Candidate[] = [];
  let inFence = false;
  let bulletCounter = 0;
  let baseIndent: number | null = null;

  const flush = () => {
    if (current.length >= 2) groups.push(current);
    current = [];
    bulletCounter = 0;
    baseIndent = null;
  };

  for (const line of lines) {
    const indent = line.match(/^\s*/)?.[0].length ?? 0;
    if (/^\s*```/.test(line)) {
      inFence = !inFence;
      continue;
    }
    if (inFence) continue;

    const numbered = NUMBERED_LINE.exec(line);
    const boldNumbered = BOLD_NUMBERED_LINE.exec(line);
    const bullet = BULLET_LINE.exec(line);

    let candidate: Candidate | null = null;

    if (numbered) {
      const body = numbered[2];
      candidate = {
        index: Number(numbered[1]),
        raw: line,
        title: cleanTitle(body),
        body,
        score: 0,
        type: "numbered",
      };
    } else if (boldNumbered) {
      const body = `${boldNumbered[2]} ${boldNumbered[3]}`.trim();
      candidate = {
        index: Number(boldNumbered[1]),
        raw: line,
        title: cleanTitle(boldNumbered[2]),
        body,
        score: 0,
        type: "numbered",
      };
    } else if (bullet) {
      if (baseIndent !== null && indent > baseIndent) continue;
      bulletCounter += 1;
      candidate = {
        index: bulletCounter,
        raw: line,
        title: cleanTitle(bullet[1]),
        body: bullet[1],
        score: 0,
        type: "bullet",
      };
    }

    if (candidate) {
      if (current.length === 0) {
        baseIndent = indent;
        bulletCounter = candidate.index;
      }
      current.push(candidate);
    } else if (line.trim() !== "") {
      flush();
    }
  }
  flush();

  const tableCandidates = parseTable(lines);
  if (tableCandidates.length >= 2) groups.push(tableCandidates);

  if (groups.length === 0) return { items: [], otherEntities: [] };

  const numberedGroups = groups.filter(
    (group) => group.length >= 2 && group.every((item) => item.type === "numbered"),
  );
  const mergedNumbered: Candidate[][] = [];
  for (const group of numberedGroups) {
    const last = mergedNumbered[mergedNumbered.length - 1];
    if (last && group[0].index > last[last.length - 1].index) {
      last.push(...group);
    } else {
      mergedNumbered.push([...group]);
    }
  }

  const nonNumberedGroups = groups.filter(
    (group) => !group.every((item) => item.type === "numbered"),
  );
  const scoredGroups = [...mergedNumbered, ...nonNumberedGroups];

  let best: Candidate[] = [];
  let bestScore = 0;

  for (const group of scoredGroups) {
    let score = 0;
    for (const item of group) {
      const matched =
        matchTargets(item.title, targets).length > 0 ||
        matchTargets(item.body.slice(0, 160), targets).length > 0;
      item.score = scoreTitle(item.title, matched);
      score += item.score;
    }
    if (score > bestScore || (score === bestScore && group.length > best.length)) {
      best = group;
      bestScore = score;
    }
  }

  if (bestScore <= 0 || best.length < 2) {
    return { items: [], otherEntities: [] };
  }

  const items: ListItem[] = best.map((candidate) => {
    const titleMentions = matchTargets(candidate.title, targets);
    const bodyMentions = matchTargets(candidate.body.slice(0, 160), targets);
    const first = titleMentions[0] ?? bodyMentions[0];

    return {
      index: candidate.index,
      raw: candidate.raw,
      title: candidate.title,
      matchedTargetId: first?.targetId,
      matchedLabel: first?.targetLabel,
    };
  });

  const otherEntities = uniq(
    items
      .filter((item) => !item.matchedTargetId)
      .map((item) => item.title)
      .filter(
        (title) =>
          title.length >= 2 &&
          title.length <= 60 &&
          !GENERIC_TITLES.test(title) &&
          COMPANY_HINTS.test(title),
      ),
  ).slice(0, 20);

  return { items, otherEntities };
}

export function attachListPositions(mentions: Mention[], items: ListItem[]): void {
  for (const mention of mentions) {
    const item = items.find((entry) => entry.matchedTargetId === mention.targetId);
    if (item) mention.listPosition = item.index;
  }
}
