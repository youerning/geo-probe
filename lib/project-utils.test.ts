import { describe, expect, it } from "vitest";
import { buildBrandTarget, parseCompetitors } from "@/lib/project-utils";

describe("parseCompetitors", () => {
  it("handles a single competitor name without pipes", () => {
    expect(parseCompetitors("纳基GEO")).toEqual([
      {
        id: "comp_1",
        kind: "competitor",
        label: "纳基GEO",
        aliases: ["纳基GEO"],
        domains: [],
      },
    ]);
  });

  it("parses display name, aliases and domains", () => {
    const [competitor] = parseCompetitors("竞品 A | 飞柚GEO, 飞柚 | feiyougeo.cn");
    expect(competitor.label).toBe("竞品 A");
    expect(competitor.aliases).toEqual(["竞品 A", "飞柚GEO", "飞柚"]);
    expect(competitor.domains).toEqual(["feiyougeo.cn"]);
  });

  it("limits competitors to five", () => {
    const lines = Array.from({ length: 8 }, (_, index) => `竞品 ${index + 1}`).join("\n");
    expect(parseCompetitors(lines)).toHaveLength(5);
  });
});

describe("buildBrandTarget", () => {
  it("always includes the brand label and de-dupes aliases", () => {
    const brand = buildBrandTarget("元构场", "元构场, 元构场智能科技", "yuangouchang.com");
    expect(brand.kind).toBe("brand");
    expect(brand.aliases).toEqual(["元构场", "元构场智能科技"]);
    expect(brand.domains).toEqual(["yuangouchang.com"]);
  });
});
