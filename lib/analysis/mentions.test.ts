import { describe, expect, it } from "vitest";
import {
  attachListPositions,
  matchTargets,
  parseListItems,
} from "@/lib/analysis/mentions";
import type { Target } from "@/lib/types";

const BRAND: Target = {
  id: "brand",
  kind: "brand",
  label: "元构场",
  aliases: ["元构场", "元构场智能科技", "yuangouchang", "yuangouchang.com"],
  domains: ["yuangouchang.com"],
};

const COMPETITOR: Target = {
  id: "comp_1",
  kind: "competitor",
  label: "竞品 A",
  aliases: ["飞柚GEO", "飞柚 GEO", "飞柚"],
  domains: ["feiyougeo.cn"],
};

describe("matchTargets", () => {
  it("matches Chinese aliases and respects order", () => {
    const mentions = matchTargets(
      "先说结论：飞柚GEO 比较活跃，元构场智能科技也有服务。",
      [BRAND, COMPETITOR],
    );

    expect(mentions).toHaveLength(2);
    expect(mentions[0].targetId).toBe("comp_1");
    expect(mentions[0].order).toBe(1);
    expect(mentions[1].targetId).toBe("brand");
    expect(mentions[1].order).toBe(2);
    expect(mentions[1].matchedAliases).toContain("元构场智能科技");
  });

  it("merges overlapping aliases into one mention", () => {
    const mentions = matchTargets("元构场智能科技提供 GEO 服务。", [BRAND]);
    expect(mentions).toHaveLength(1);
    expect(mentions[0].count).toBe(1);
    expect(mentions[0].matchedAliases).toEqual(
      expect.arrayContaining(["元构场", "元构场智能科技"]),
    );
  });

  it("uses word boundaries for Latin aliases", () => {
    const george = matchTargets("George 是一家公司。", [BRAND]);
    expect(george).toHaveLength(0);

    const match = matchTargets("yuangouchang.com 是官网。", [BRAND]);
    expect(match).toHaveLength(1);
    expect(match[0].targetId).toBe("brand");
  });
});

describe("parseListItems", () => {
  const answer = [
    "**一、技术型**",
    "1. **飞柚 GEO（深圳飞柚数智营销技术有限公司）**",
    " - 南山，2019 年成立。",
    " - 自研系统。",
    "",
    "2. **元构场智能科技**",
    " - 深圳龙华。",
    "",
    "**二、其他**",
    "3. **另一家科技公司**",
    "4. **第四家公司**",
    "",
    "## 三、建议",
    "- 先查工商信息",
    "- 再签合同",
  ].join("\n");

  it("merges numbered sections and skips nested bullets", () => {
    const { items, otherEntities } = parseListItems(answer, [BRAND, COMPETITOR]);
    expect(items.map((item) => item.index)).toEqual([1, 2, 3, 4]);
    expect(items[0].title).toBe("飞柚 GEO");
    expect(items[0].matchedTargetId).toBe("comp_1");
    expect(items[1].matchedTargetId).toBe("brand");
    expect(items[3].title).toBe("第四家公司");
    expect(otherEntities).toContain("另一家科技公司");
  });

  it("attaches list positions to mentions", () => {
    const mentions = matchTargets(answer, [BRAND, COMPETITOR]);
    const { items } = parseListItems(answer, [BRAND, COMPETITOR]);
    attachListPositions(mentions, items);

    const brand = mentions.find((mention) => mention.targetId === "brand");
    const competitor = mentions.find((mention) => mention.targetId === "comp_1");
    expect(brand?.listPosition).toBe(2);
    expect(competitor?.listPosition).toBe(1);
  });

  it("does not treat section headings as list items", () => {
    const { items } = parseListItems(answer, [BRAND, COMPETITOR]);
    expect(items.every((item) => !item.title.startsWith("二、"))).toBe(true);
  });
});
