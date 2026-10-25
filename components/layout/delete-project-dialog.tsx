"use client";

import { useState } from "react";
import { Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { deleteProject, listProjects } from "@/lib/db/repositories";
import { deleteDemo } from "@/lib/demo/seed";
import { useAppStore } from "@/lib/hooks/use-app-store";
import type { Project } from "@/lib/types";

export function DeleteProjectDialog({
  project,
  open,
  onOpenChange,
}: {
  project: Project | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const setSelectedProjectId = useAppStore((state) => state.setSelectedProjectId);
  const [deleting, setDeleting] = useState(false);

  const handleDelete = async () => {
    if (!project) return;

    setDeleting(true);
    try {
      if (project.isDemo) await deleteDemo();
      else await deleteProject(project.id);

      const remaining = await listProjects();
      setSelectedProjectId(remaining[0]?.id ?? null);
      toast.success(`项目「${project.name}」已删除。`);
      onOpenChange(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "删除失败。");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <AlertDialog open={open && Boolean(project)} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>删除项目？</AlertDialogTitle>
          <AlertDialogDescription>
            确定删除「{project?.name}」吗？
            {project?.isDemo
              ? "这是示例项目，删除后仍可从设置页或首屏重新恢复。"
              : "该项目下的提示词、批次、回答和来源都会一并删除，无法恢复。"}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>取消</AlertDialogCancel>
          <AlertDialogAction onClick={handleDelete} disabled={deleting}>
            {deleting ? <Loader2 className="animate-spin" /> : <Trash2 />}
            删除
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
