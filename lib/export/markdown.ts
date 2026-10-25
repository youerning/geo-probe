import type { Probe, Prompt, Run, RunMetrics } from "@/lib/types";
import { formatCurrency, formatDateTime, formatPercent } from "@/lib/utils/format";
import { APP_NAME, APP_VERSION, DISCLAIMER } from "@/lib/config";

export function runToMarkdown(params: {
  run: Run;
  probes: Probe[];
  prompts: Prompt[];
  metrics: RunMetrics;
}): string {
  const { run, probes, prompts, metrics } = params;
  const lines: string[] = [];

  lines.push(`# ${run.name}`);
  lines.push("");
  lines.push(`- 项目：${run.projectId}`);
  lines.push(`- 时间：${formatDateTime(run.startedAt)}`);
  lines.push(`- 模型：${run.config.model}`);
  lines.push(`- 批次状态：${run.status}`);
  lines.push(`- 探测数：${metrics.successCount}/${metrics.probeCount}`);
  lines.push("");
  lines.push("## 核心指标");
  lines.push("");
  lines.push("| 指标 | 数值 |");
  lines.push("| --- | --- |");
  lines.push(`| 提及率 | ${formatPercent(metrics.mentionRate)} |`);
  lines.push(`| 首位提及率 | ${formatPercent(metrics.firstRate)} |`);
  lines.push(`| 平均位次 | ${metrics.avgOrder ? metrics.avgOrder.toFixed(2) : "—"} |`);
  lines.push(`| 官网检索可见度 | ${formatPercent(metrics.ownedDomain.rate)} |`);
  lines.push(
    `| 来源稳定性 | ${metrics.sourceStability === null ? "—" : formatPercent(metrics.sourceStability)} |`,
  );
  lines.push(`| 唯一来源域名 | ${metrics.uniqueDomainCount} |`);
  lines.push(`| 搜索次数 | ${metrics.webSearchRequests} |`);
  lines.push(`| 估算费用 | ${formatCurrency(metrics.estimatedCost)} |`);
  lines.push("");

  if (metrics.insights.length) {
    lines.push("## 关键发现");
    lines.push("");
    for (const insight of metrics.insights) {
      lines.push(`- **${insight.title}**：${insight.description}`);
    }
    lines.push("");
  }

  lines.push("## Prompt 表现");
  lines.push("");
  lines.push("| 提示词 | 标签 | 提及率 | 首位率 | 平均位次 |");
  lines.push("| --- | --- | --- | --- | --- |");
  for (const prompt of prompts) {
    const group = probes.filter((probe) => probe.promptId === prompt.id);
    const successes = group.filter((probe) => probe.status === "success");
    const brandId =
      run.aliasSnapshot.find((target) => target.kind === "brand")?.id ?? "brand";
    const mentioned = successes.filter((probe) =>
      probe.mentions.some((mention) => mention.targetId === brandId),
    );
    const orders = mentioned
      .map((probe) => probe.mentions.find((mention) => mention.targetId === brandId)?.order)
      .filter((value): value is number => typeof value === "number");
    lines.push(
      `| ${prompt.text.replace(/\|/g, "\\|")} | ${prompt.tags.join(", ")} | ${
        successes.length ? formatPercent(mentioned.length / successes.length) : "—"
      } | — | ${orders.length ? (orders.reduce((sum, value) => sum + value, 0) / orders.length).toFixed(2) : "—"} |`,
    );
  }
  lines.push("");

  lines.push("## Top 来源域名");
  lines.push("");
  lines.push("| 平台/域名 | 归属 | 渠道 | 出现率 | 平均位次 | 来源次数 |");
  lines.push("| --- | --- | --- | --- | --- | --- |");
  for (const stat of metrics.domainStats.slice(0, 15)) {
    lines.push(
      `| ${stat.platform || stat.domain} | ${stat.ownership} | ${stat.channel} | ${formatPercent(
        stat.appearanceRate,
      )} | ${stat.avgRank.toFixed(1)} | ${stat.occurrenceCount} |`,
    );
  }
  lines.push("");

  if (metrics.newDomains.length || metrics.lostDomains.length) {
    lines.push("## 来源变化");
    lines.push("");
    lines.push(`- 新增：${metrics.newDomains.join(", ") || "—"}`);
    lines.push(`- 流失：${metrics.lostDomains.join(", ") || "—"}`);
    lines.push("");
  }

  lines.push("## 说明");
  lines.push("");
  lines.push(
    "“AI 引用”指回答中出现品牌/产品名；“检索来源”指搜索工具返回的网页，不代表模型逐句引用。",
  );
  lines.push("");
  lines.push(DISCLAIMER);
  lines.push("");
  lines.push(`由 ${APP_NAME} v${APP_VERSION} 生成。`);

  return lines.join("\n");
}
