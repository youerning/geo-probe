import { describe, expect, it } from "vitest";
import {
  buildBrandTarget,
  draftsToTargets,
  formatBrandAliases,
  targetsToDrafts,
} from "@/lib/project-utils";

describe("draftsToTargets", () => {
  it("handles a single competitor name", () => {
    expect(
      draftsToTargets([{ label: "纳基GEO", aliases: "", domains: "" }]),
    ).toEqual([
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
    const [competitor] = draftsToTargets([
      { label: "竞品 A", aliases: "飞柚GEO, 飞柚", domains: "feiyougeo.cn" },
    ]);
    expect(competitor.label).toBe("竞品 A");
    expect(competitor.aliases).toEqual(["竞品 A", "飞柚GEO", "飞柚"]);
    expect(competitor.domains).toEqual(["feiyougeo.cn"]);
  });

  it("ignores empty rows and limits competitors to five", () => {
    const drafts = Array.from({ length: 8 }, (_, index) => ({
      label: `竞品 ${index + 1}`,
      aliases: "",
      domains: "",
    }));
    expect(
      draftsToTargets([{ label: "  ", aliases: "别名", domains: "" }, ...drafts]),
    ).toHaveLength(5);
  });
});

describe("targetsToDrafts", () => {
  it("does not repeat the label in the aliases input", () => {
    expect(
      targetsToDrafts([
        {
          id: "comp_1",
          kind: "competitor",
          label: "纳基GEO",
          aliases: ["纳基GEO", "纳基 GEO"],
          domains: ["feiyougeo.cn"],
        },
      ]),
    ).toEqual([
      {
        label: "纳基GEO",
        aliases: "纳基 GEO",
        domains: "feiyougeo.cn",
      },
    ]);
  });

  it("round-trips edited competitors", () => {
    const targets = [
      {
        id: "comp_1",
        kind: "competitor" as const,
        label: "纳基GEO",
        aliases: ["纳基GEO", "纳基 GEO"],
        domains: [],
      },
      {
        id: "comp_2",
        kind: "competitor" as const,
        label: "飞柚GEO",
        aliases: ["飞柚GEO"],
        domains: ["feiyougeo.cn"],
      },
    ];
    expect(draftsToTargets(targetsToDrafts(targets))).toEqual(targets);
  });
});

describe("formatBrandAliases", () => {
  it("omits the brand label from the alias list", () => {
    const brand = buildBrandTarget("元构场", "元构场, 元构场智能科技", "yuangouchang.com");
    expect(formatBrandAliases(brand)).toBe("元构场智能科技");
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
