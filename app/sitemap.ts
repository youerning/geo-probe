import type { MetadataRoute } from "next";

export const dynamic = "force-static";

export default function sitemap(): MetadataRoute.Sitemap {
  const base = "https://geo-probe.youerning.top";
  const routes = ["/", "/prompts/", "/run/", "/runs/", "/settings/"];
  return routes.map((route) => ({
    url: `${base}${route}`,
    lastModified: new Date("2026-10-25"),
    changeFrequency: route === "/" ? "weekly" : "monthly",
    priority: route === "/" ? 1 : 0.6,
  }));
}
