import { parse as parseDomain } from "tldts";
import type {
  AnswerLink,
  RawSource,
  SearchSource,
  SourceChannel,
  SourceOwnership,
  Target,
} from "@/lib/types";
import { uniq } from "@/lib/utils/array";
import { findMentionedTargets } from "./mentions";

export type UrlParts = {
  url: string;
  canonicalUrl: string;
  host: string;
  domain: string;
};

export type SourceClassification = {
  platform: string;
  channel: SourceChannel;
  ownership: SourceOwnership;
  competitorId?: string;
};

const TRACKING_PARAMS = new Set([
  "ref",
  "refcode",
  "srccode",
  "from",
  "to",
  "bst",
  "actionid",
  "spm",
  "scm",
  "share_token",
  "share_source",
  "share_from",
  "openapi_platform",
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_term",
  "utm_content",
]);

const PLATFORM_RULES: Array<{
  test: (host: string, domain: string) => boolean;
  platform: string;
  channel: SourceChannel;
}> = [
  {
    test: (host) => host === "mp.weixin.qq.com",
    platform: "微信公众号",
    channel: "wechat",
  },
  {
    test: (host, domain) => host.includes("baike") && domain.endsWith("baidu.com"),
    platform: "百度百科",
    channel: "encyclopedia",
  },
  {
    test: (_host, domain) => domain === "wikipedia.org",
    platform: "维基百科",
    channel: "encyclopedia",
  },
  {
    test: (_host, domain) => domain === "zhihu.com",
    platform: "知乎",
    channel: "social",
  },
  {
    test: (_host, domain) => domain === "bilibili.com",
    platform: "哔哩哔哩",
    channel: "social",
  },
  {
    test: (_host, domain) => domain === "xiaohongshu.com",
    platform: "小红书",
    channel: "social",
  },
  {
    test: (_host, domain) => domain === "douyin.com",
    platform: "抖音",
    channel: "social",
  },
  {
    test: (_host, domain) => domain === "weibo.com",
    platform: "微博",
    channel: "social",
  },
  {
    test: (_host, domain) => domain === "tianyancha.com",
    platform: "天眼查",
    channel: "directory",
  },
  {
    test: (_host, domain) => domain === "qcc.com",
    platform: "企查查",
    channel: "directory",
  },
  {
    test: (_host, domain) => domain === "zhaopin.com",
    platform: "智联招聘",
    channel: "directory",
  },
  {
    test: (_host, domain) => domain === "dianhua.cn",
    platform: "电话邦",
    channel: "directory",
  },
  {
    test: (host) => host === "apps.apple.com",
    platform: "App Store",
    channel: "app_store",
  },
  {
    test: (host) => host === "app.xiaomi.com",
    platform: "小米应用商店",
    channel: "app_store",
  },
  {
    test: (_host, domain) =>
      ["weiyangx.com", "36kr.com", "huxiu.com", "sohu.com", "163.com", "sina.com.cn", "ifeng.com", "thepaper.cn", "zqbao.com.cn"].includes(
        domain,
      ),
    platform: "新闻媒体",
    channel: "news",
  },
  {
    test: (_host, domain) => domain === "gov.cn" || domain.endsWith(".gov.cn"),
    platform: "政府网站",
    channel: "official",
  },
  {
    test: (_host, domain) => domain === "edu.cn" || domain.endsWith(".edu.cn"),
    platform: "教育机构",
    channel: "official",
  },
  {
    test: (_host, domain) => domain === "baidu.com",
    platform: "百度",
    channel: "other",
  },
  {
    test: (_host, domain) => domain === "qq.com",
    platform: "腾讯",
    channel: "other",
  },
  {
    test: (_host, domain) =>
      ["ithome.com", "36kr.com", "huxiu.com", "tmtpost.com", "geekpark.net", "ifanr.com", "leiphone.com", "donews.com", "techweb.com.cn", "cnbeta.com.tw", "newrank.cn", "toutiao.com"].includes(
        domain,
      ),
    platform: "科技/资讯媒体",
    channel: "news",
  },
  {
    test: (_host, domain) =>
      ["cnblogs.com", "segmentfault.com", "v2ex.com", "juejin.cn", "csdn.net"].includes(domain),
    platform: "技术社区",
    channel: "social",
  },
  {
    test: (_host, domain) => domain === "csdn.net",
    platform: "CSDN",
    channel: "social",
  },
  {
    test: (_host, domain) => domain === "juejin.cn",
    platform: "掘金",
    channel: "social",
  },
];

function cleanDomain(input: string): string {
  return input
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/\/.*$/, "")
    .replace(/^www\./, "")
    .trim();
}

function domainMatches(host: string, domain: string, targetDomain: string): boolean {
  const candidate = cleanDomain(targetDomain);
  if (!candidate) return false;
  return (
    host === candidate ||
    host.endsWith(`.${candidate}`) ||
    domain === candidate ||
    domain.endsWith(`.${candidate}`)
  );
}

export function normalizeUrlParts(raw: string): UrlParts | null {
  try {
    const parsed = new URL(raw);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return null;

    parsed.hash = "";
    for (const key of Array.from(parsed.searchParams.keys())) {
      const lower = key.toLowerCase();
      if (TRACKING_PARAMS.has(lower) || lower.startsWith("utm_")) {
        parsed.searchParams.delete(key);
      }
    }

    let canonicalUrl = parsed.toString();
    if (canonicalUrl.endsWith("/")) canonicalUrl = canonicalUrl.slice(0, -1);

    const host = parsed.hostname.toLowerCase();
    const domain = parseDomain(host).domain || host;

    return {
      url: canonicalUrl,
      canonicalUrl,
      host,
      domain,
    };
  } catch {
    return null;
  }
}

export function classifySource(parts: UrlParts, targets: Target[]): SourceClassification {
  const brand = targets.find((target) => target.kind === "brand");
  if (brand && brand.domains.some((domain) => domainMatches(parts.host, parts.domain, domain))) {
    return {
      platform: brand.label,
      channel: "other",
      ownership: "owned",
    };
  }

  for (const target of targets) {
    if (target.kind !== "competitor") continue;
    if (target.domains.some((domain) => domainMatches(parts.host, parts.domain, domain))) {
      return {
        platform: target.label,
        channel: "other",
        ownership: "competitor",
        competitorId: target.id,
      };
    }
  }

  const rule = PLATFORM_RULES.find((entry) => entry.test(parts.host, parts.domain));
  if (rule) {
    return {
      platform: rule.platform,
      channel: rule.channel,
      ownership: "third_party",
    };
  }

  return {
    platform: parts.domain || parts.host || "未知来源",
    channel: "other",
    ownership: "third_party",
  };
}

export function normalizeSources(rawSources: RawSource[], targets: Target[]): SearchSource[] {
  const map = new Map<string, SearchSource>();

  for (const raw of rawSources) {
    const parts = normalizeUrlParts(raw.url);
    if (!parts) continue;

    const classification = classifySource(parts, targets);
    const occurrence = {
      queryId: raw.queryId,
      query: raw.query,
      rank: raw.rank,
    };

    const existing = map.get(parts.canonicalUrl);
    if (existing) {
      existing.occurrences.push(occurrence);
      if ((raw.title?.length ?? 0) > (existing.title?.length ?? 0)) {
        existing.title = raw.title;
      }
      if (!existing.pageAge && raw.pageAge) existing.pageAge = raw.pageAge;
      continue;
    }

    map.set(parts.canonicalUrl, {
      id: "",
      title: raw.title || "",
      url: parts.url,
      canonicalUrl: parts.canonicalUrl,
      host: parts.host,
      domain: parts.domain,
      platform: classification.platform,
      pageAge: raw.pageAge,
      channel: classification.channel,
      ownership: classification.ownership,
      competitorId: classification.competitorId,
      titleMentions: findMentionedTargets(raw.title || "", targets),
      occurrences: [occurrence],
    });
  }

  const sources = Array.from(map.values());
  sources.forEach((source, index) => {
    source.id = `src_${index + 1}`;
    source.occurrences.sort((a, b) => a.rank - b.rank);
  });

  sources.sort((a, b) => {
    const bestA = Math.min(...a.occurrences.map((occurrence) => occurrence.rank));
    const bestB = Math.min(...b.occurrences.map((occurrence) => occurrence.rank));
    if (bestA !== bestB) return bestA - bestB;
    return a.title.localeCompare(b.title, "zh-CN");
  });

  return sources;
}

const MARKDOWN_LINK = /\[([^\]]*)\]\((https?:\/\/[^)\s]+)\)/g;
const BARE_URL = /https?:\/\/[^\s<>"'）)\]]+/g;

function cleanUrlCandidate(input: string): string {
  return input.replace(/[.,;:!?，。；：！？]+$/g, "").replace(/[）)\]]+$/g, "");
}

export function extractAnswerLinks(
  answer: string,
  targets: Target[],
  sources: SearchSource[],
): AnswerLink[] {
  const urls: string[] = [];

  for (const match of answer.matchAll(MARKDOWN_LINK)) {
    if (match[2]) urls.push(match[2]);
  }
  for (const match of answer.matchAll(BARE_URL)) {
    if (match[0]) urls.push(match[0]);
  }

  const sourceSet = new Set(sources.map((source) => source.canonicalUrl));
  const seen = new Set<string>();
  const links: AnswerLink[] = [];

  for (const raw of urls) {
    const parts = normalizeUrlParts(cleanUrlCandidate(raw));
    if (!parts || seen.has(parts.canonicalUrl)) continue;
    seen.add(parts.canonicalUrl);
    const classification = classifySource(parts, targets);

    links.push({
      url: parts.url,
      canonicalUrl: parts.canonicalUrl,
      host: parts.host,
      domain: parts.domain,
      platform: classification.platform,
      channel: classification.channel,
      ownership: classification.ownership,
      inSources: sourceSet.has(parts.canonicalUrl),
    });
  }

  return links.slice(0, 50);
}

export function uniqueDomains(sources: SearchSource[]): string[] {
  return uniq(sources.map((source) => source.domain || source.host).filter(Boolean));
}
