"use client";

import { useState } from "react";
import { Check, ChevronsUpDown, Plus, Sparkles, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAppStore } from "@/lib/hooks/use-app-store";
import { useProjects } from "@/lib/hooks/use-data";
import { cn } from "cn";
import { DeleteProjectDialog } from "./delete-project-dialog";
import { ProjectDialog } from "./project-dialog";

export function ProjectSwitcher({ compact = false }: { compact?: boolean }) {
  const projects = useProjects();
  const selectedProjectId = useAppStore((state) => state.selectedProjectId);
  const setSelectedProjectId = useAppStore((state) => state.setSelectedProjectId);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const selected = projects?.find((project) => project.id === selectedProjectId);

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              variant="outline"
              className={cn(
                "h-auto w-full justify-between gap-2 px-3 py-2 text-left",
                compact && "px-2.5 py-1.5",
              )}
            >
              <span className="flex min-w-0 items-center gap-2">
                <span className="flex size-6 shrink-0 items-center justify-center rounded-md bg-primary/10 text-[11px] font-semibold text-primary">
                  {(selected?.brand.label ?? "P").slice(0, 1)}
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium">
                    {selected?.name ?? "选择项目"}
                  </span>
                  {!compact && (
                    <span className="block truncate text-[11px] text-muted-foreground">
                      {selected?.brand.label ?? "还没有项目"}
                    </span>
                  )}
                </span>
                {selected?.isDemo && (
                  <Badge variant="secondary" className="ml-1 shrink-0 px-1.5 text-[10px]">
                    示例
                  </Badge>
                )}
              </span>
              <ChevronsUpDown className="size-3.5 shrink-0 text-muted-foreground" />
            </Button>
          }
        />
        <DropdownMenuContent align="start" className="w-64">
          <DropdownMenuGroup>
            <DropdownMenuLabel>项目</DropdownMenuLabel>
            {projects?.map((project) => (
              <DropdownMenuItem
                key={project.id}
                onClick={() => setSelectedProjectId(project.id)}
                className="gap-2"
              >
                <span className="flex size-6 items-center justify-center rounded-md bg-muted text-[11px] font-semibold">
                  {project.brand.label.slice(0, 1)}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm">{project.name}</span>
                  <span className="block truncate text-[11px] text-muted-foreground">
                    {project.brand.label}
                  </span>
                </span>
                {project.isDemo && <Sparkles className="size-3 text-chart-1" />}
                {project.id === selectedProjectId && <Check className="size-3.5 text-primary" />}
              </DropdownMenuItem>
            ))}
            {!projects?.length && (
              <div className="px-2 py-3 text-xs text-muted-foreground">还没有项目。</div>
            )}
          </DropdownMenuGroup>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => setDialogOpen(true)} className="gap-2">
            <Plus className="size-3.5" />
            新建项目
          </DropdownMenuItem>
          {selected && (
            <DropdownMenuItem
              variant="destructive"
              onClick={() => setDeleteOpen(true)}
              className="gap-2"
            >
              <Trash2 className="size-3.5" />
              删除当前项目
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      <ProjectDialog open={dialogOpen} onOpenChange={setDialogOpen} />
      <DeleteProjectDialog
        project={selected ?? null}
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
      />
    </>
  );
}
