"use client";

import { useState } from "react";
import { ArrowRight, Loader2, Sparkles, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { deleteDemo } from "@/lib/demo/seed";
import { useAppStore } from "@/lib/hooks/use-app-store";
import type { Project } from "@/lib/types";
import { ProjectDialog } from "./project-dialog";

export function DemoBanner({ project }: { project: Project }) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const setSelectedProjectId = useAppStore((state) => state.setSelectedProjectId);

  if (!project.isDemo) return null;

  const handleDelete = async () => {
    if (!window.confirm("删除示例数据？你的其他项目不会被影响。")) return;
    setDeleting(true);
    try {
      await deleteDemo();
      setSelectedProjectId(null);
      toast.success("示例数据已删除。");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "删除失败。");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <>
      <div className="relative overflow-hidden rounded-xl border border-chart-1/20 bg-chart-1/[0.04] p-4">
        <div className="pointer-events-none absolute -right-8 -top-10 size-40 rounded-full bg-chart-1/10 blur-2xl" />
        <div className="relative flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex gap-3">
            <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg bg-chart-1/12 text-chart-1">
              <Sparkles className="size-4" />
            </span>
            <div className="space-y-0.5">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">你正在查看示例数据</span>
                <span className="rounded-full bg-chart-1/10 px-2 py-0.5 text-[10px] font-medium text-chart-1">
                  非实时
                </span>
              </div>
              <p className="max-w-2xl text-xs leading-5 text-muted-foreground">
                这是元构场的一次真实探测快照，用来说明仪表盘和来源分析怎么用。AI 可能引用过时或不准确的信息。删除后可以随时恢复。
              </p>
            </div>
          </div>
          <div className="flex shrink-0 flex-wrap items-center gap-2 pl-11 sm:pl-0">
            <Button size="sm" onClick={() => setDialogOpen(true)}>
              创建自己的项目
              <ArrowRight />
            </Button>
            <Button size="sm" variant="ghost" onClick={handleDelete} disabled={deleting}>
              {deleting ? <Loader2 className="animate-spin" /> : <Trash2 />}
              删除示例
            </Button>
          </div>
        </div>
      </div>
      <ProjectDialog open={dialogOpen} onOpenChange={setDialogOpen} />
    </>
  );
}
