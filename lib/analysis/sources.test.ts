import { describe, expect, it } from "vitest";
import {
  classifySource,
  extractAnswerLinks,
  normalizeSources,
  normalizeUrlParts,
} from "@/lib/analysis/sources";
import type { Target } from "@/lib/types";

const BRAND: Target = {
  id: "brand",
  kind: "brand",
  label: "元构场",
  aliases: ["元构场"],
  domains: ["yuangouchang.com"],
};

const COMPETITOR: Target = {
  id: "comp_1",
  kind: "competitor",
  label: "竞品 A",
  aliases: ["飞柚GEO"],
  domains: ["feiyougeo.cn"],
};

describe("normalizeUrlParts", () => {
  it("strips hash, tracking params and extracts the registrable domain", () => {
    const parts = normalizeUrlParts(
      "https://wapbaike.baidu.com/item/example?utm_source=test&id=1#section",
    );
    expect(parts).not.toBeNull();
    expect(parts?.canonicalUrl).toBe("https://wapbaike.baidu.com/item/example?id=1");
    expect(parts?.host).toBe("wapbaike.baidu.com");
    expect(parts?.domain).toBe("baidu.com");
  });

  it("rejects non-http URLs", () => {
    expect(normalizeUrlParts("javascript:alert(1)")).toBeNull();
    expect(normalizeUrlParts("not a url")).toBeNull();
  });
});

describe("classifySource", () => {
  it("classifies Baidu Baike and WeChat", () => {
    const baike = normalizeUrlParts("https://baike.baidu.com/item/x");
    const wechat = normalizeUrlParts("https://mp.weixin.qq.com/s/abc");
    expect(baike && classifySource(baike, [BRAND, COMPETITOR])).toMatchObject({
      platform: "百度百科",
      channel: "encyclopedia",
      ownership: "third_party",
    });
    expect(wechat && classifySource(wechat, [BRAND, COMPETITOR])).toMatchObject({
      platform: "微信公众号",
      channel: "wechat",
      ownership: "third_party",
    });
  });

  it("detects owned and competitor domains", () => {
    const owned = normalizeUrlParts("https://www.yuangouchang.com/about");
    const competitor = normalizeUrlParts("https://www.feiyougeo.cn/case");
    expect(owned && classifySource(owned, [BRAND, COMPETITOR]).ownership).toBe("owned");
    expect(competitor && classifySource(competitor, [BRAND, COMPETITOR]).ownership).toBe(
      "competitor",
    );
  });
});

describe("normalizeSources", () => {
  it("dedupes the same canonical URL across queries and keeps occurrences", () => {
    const sources = normalizeSources(
      [
        {
          queryId: "q1",
          query: "深圳 GEO 公司",
          rank: 3,
          title: "元构场 GEO",
          url: "https://www.yuangouchang.com/about#1",
          pageAge: null,
        },
        {
          queryId: "q2",
          query: "深圳 GEO 服务商",
          rank: 1,
          title: "元构场 GEO",
          url: "https://www.yuangouchang.com/about?utm_source=test",
          pageAge: "2026-01-01",
        },
      ],
      [BRAND, COMPETITOR],
    );

    expect(sources).toHaveLength(1);
    expect(sources[0].occurrences).toHaveLength(2);
    expect(sources[0].occurrences[0].rank).toBe(1);
    expect(sources[0].ownership).toBe("owned");
    expect(sources[0].titleMentions).toContain("元构场");
  });

  it("keeps different URLs separate", () => {
    const sources = normalizeSources(
      [
        {
          queryId: "q1",
          query: "a",
          rank: 1,
          title: "飞柚GEO",
          url: "https://www.feiyougeo.cn/a",
          pageAge: null,
        },
        {
          queryId: "q1",
          query: "a",
          rank: 2,
          title: "知乎",
          url: "https://zhuanlan.zhihu.com/p/1",
          pageAge: null,
        },
      ],
      [BRAND, COMPETITOR],
    );
    expect(sources).toHaveLength(2);
    expect(sources.find((source) => source.ownership === "competitor")?.platform).toBe("竞品 A");
  });
});

describe("extractAnswerLinks", () => {
  it("marks links that also appear in retrieved sources", () => {
    const sources = normalizeSources(
      [
        {
          queryId: "q1",
          query: "a",
          rank: 1,
          title: "官网",
          url: "https://www.yuangouchang.com/about",
          pageAge: null,
        },
      ],
      [BRAND, COMPETITOR],
    );

    const links = extractAnswerLinks(
      "官网：[元构场](https://www.yuangouchang.com/about)，另一个链接 https://example.com/x。",
      [BRAND, COMPETITOR],
      sources,
    );

    expect(links).toHaveLength(2);
    expect(links.find((link) => link.domain === "yuangouchang.com")?.inSources).toBe(true);
    expect(links.find((link) => link.domain === "example.com")?.inSources).toBe(false);
  });
});
