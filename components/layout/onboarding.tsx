"use client";

import { useState } from "react";
import {
  ArrowRight,
  BarChart3,
  Globe2,
  Layers3,
  Loader2,
  Lock,
  Radar,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { restoreDemo } from "@/lib/demo/seed";
import { useAppStore } from "@/lib/hooks/use-app-store";
import { ProjectDialog } from "./project-dialog";

const FEATURES = [
  {
    icon: Layers3,
    title: "批量向 AI 提问",
    description: "一轮跑完几十条真实用户问题，不用在 App 里反复新建会话。",
  },
  {
    icon: Radar,
    title: "品牌 + 竞品提及",
    description: "公司名、产品名、别名一起匹配，算出提及率、首位率和声量份额。",
  },
  {
    icon: Globe2,
    title: "检索来源与域名",
    description: "记录 AI 搜到的网页，统计来源域名、渠道结构、官网可见度。",
  },
  {
    icon: Lock,
    title: "数据只在你手里",
    description: "纯静态、无后端、无遥测。API Key 和数据只存在浏览器本地。",
  },
];

export function Onboarding() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [loadingDemo, setLoadingDemo] = useState(false);
  const setSelectedProjectId = useAppStore((state) => state.setSelectedProjectId);

  const handleDemo = async () => {
    setLoadingDemo(true);
    try {
      const project = await restoreDemo();
      if (!project) {
        toast.error("示例数据不可用，请创建自己的项目。");
        return;
      }
      setSelectedProjectId(project.id);
      toast.success("示例数据已加载。");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "加载失败。");
    } finally {
      setLoadingDemo(false);
    }
  };

  return (
    <div className="space-y-8 py-4">
      <div className="relative overflow-hidden rounded-2xl border bg-card p-8 sm:p-12">
        <div className="pointer-events-none absolute inset-0 bg-grid opacity-40 [mask-image:radial-gradient(ellipse_at_top,black,transparent_70%)]" />
        <div className="relative mx-auto max-w-3xl text-center">
          <div className="mx-auto mb-5 flex size-14 items-center justify-center rounded-2xl bg-gradient-to-br from-chart-1 to-chart-2 text-white shadow-lg shadow-chart-1/20">
            <Radar className="size-7" />
          </div>
          <div className="mb-3 inline-flex items-center gap-1.5 rounded-full border bg-background/70 px-3 py-1 text-xs text-muted-foreground backdrop-blur">
            <Sparkles className="size-3.5 text-chart-1" />
            GEO · 生成式引擎优化
          </div>
          <h1 className="text-balance text-3xl font-semibold tracking-tight sm:text-4xl">
            你的品牌，被 AI 提到了吗？
          </h1>
          <p className="mx-auto mt-3 max-w-xl text-balance text-sm leading-6 text-muted-foreground sm:text-base">
            批量向 DeepSeek 提问，检测 AI 回答里有没有出现你的公司或产品名，追踪竞品声量、检索来源和官网可见度。
          </p>
          <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
            <Button size="lg" onClick={() => setDialogOpen(true)}>
              创建第一个项目
              <ArrowRight />
            </Button>
            <Button size="lg" variant="outline" onClick={handleDemo} disabled={loadingDemo}>
              {loadingDemo ? <Loader2 className="animate-spin" /> : <BarChart3 />}
              先看示例数据
            </Button>
          </div>
          <p className="mt-3 text-xs text-muted-foreground">
            不需要 API Key 就能浏览示例；真实探测才需要。
          </p>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {FEATURES.map((feature) => (
          <Card key={feature.title} className="bg-card/60">
            <CardContent className="space-y-2.5 p-5">
              <span className="flex size-9 items-center justify-center rounded-lg bg-muted text-foreground">
                <feature.icon className="size-4.5" />
              </span>
              <div className="text-sm font-medium">{feature.title}</div>
              <p className="text-xs leading-5 text-muted-foreground">{feature.description}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <ProjectDialog open={dialogOpen} onOpenChange={setDialogOpen} />
    </div>
  );
}
