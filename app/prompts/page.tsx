"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Lightbulb,
  ListChecks,
  MoreHorizontal,
  Pencil,
  Plus,
  Trash2,
  Upload,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/empty-state";
import { NoProjectState } from "@/components/no-project-state";
import { PageHeader } from "@/components/page-header";
import { TagList } from "@/components/tag-badge";
import { ImportDialog } from "@/components/prompts/import-dialog";
import { PromptDialog } from "@/components/prompts/prompt-dialog";
import { computePromptMetricsList } from "@/lib/analysis/metrics";
import { createPrompt, deletePrompt } from "@/lib/db/repositories";
import { useAppStore } from "@/lib/hooks/use-app-store";
import { useProject, usePrompts, useProbes, useRuns } from "@/lib/hooks/use-data";
import type { Prompt } from "@/lib/types";
import { formatPercent } from "@/lib/utils/format";

export default function PromptsPage() {
  const router = useRouter();
  const selectedProjectId = useAppStore((state) => state.selectedProjectId);
  const project = useProject(selectedProjectId);
  const prompts = usePrompts(project?.id);
  const runs = useRuns(project?.id);
  const latestRun = runs?.[0];
  const probes = useProbes(latestRun?.id);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [editing, setEditing] = useState<Prompt | null>(null);
  const [deleting, setDeleting] = useState<Prompt | null>(null);

  const brandId =
    latestRun?.aliasSnapshot.find((target) => target.kind === "brand")?.id ??
    project?.brand.id ??
    "brand";

  const metrics = useMemo(() => {
    if (!prompts || !probes) return [];
    return computePromptMetricsList(prompts, probes, brandId);
  }, [prompts, probes, brandId]);

  if (!project) {
    return <NoProjectState />;
  }

  if (!prompts) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-64 rounded-xl" />
      </div>
    );
  }

  const suggestions = [
    { text: "推荐几家深圳做 GEO 生成式引擎优化的公司", tags: ["general"] },
    { text: "深圳 GEO 优化服务商哪家专业？", tags: ["general"] },
    { text: `${project.brand.label} GEO 优化效果怎么样？`, tags: ["brand"] },
    { text: `${project.brand.label}提供哪些 GEO 服务？`, tags: ["brand"] },
  ];

  const addSuggestion = async (text: string, tags: string[]) => {
    if (prompts.some((prompt) => prompt.text.trim() === text)) {
      toast.message("这条提示词已经有了。");
      return;
    }
    await createPrompt({ projectId: project.id, text, tags, enabled: true });
    toast.success("示例提示词已添加。");
  };

  const handleDelete = async () => {
    if (!deleting) return;
    try {
      await deletePrompt(deleting.id);
      toast.success("提示词已删除。");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "删除失败。");
    } finally {
      setDeleting(null);
    }
  };

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="提示词"
        title="批量提问清单"
        description="用真实用户会问 AI 的方式写。建议 10–20 条：太少看不出趋势，太多会推高成本、稀释结论。"
        actions={
          <>
            <Button variant="outline" onClick={() => setImportOpen(true)}>
              <Upload />
              批量导入
            </Button>
            <Button
              onClick={() => {
                setEditing(null);
                setDialogOpen(true);
              }}
            >
              <Plus />
              添加提示词
            </Button>
          </>
        }
      />

      <div className="flex gap-2.5 rounded-xl border bg-muted/30 p-4 text-xs leading-5 text-muted-foreground">
        <Lightbulb className="mt-0.5 size-4 shrink-0" />
        <p>
          建议混合通用词、品牌词、产品词、本地词和竞品词。通用词看“AI 会不会主动推荐你”，品牌词看“AI 是否认识你”。
          每条默认跑 3 次，减少模型随机性。
        </p>
      </div>

      {prompts.length === 0 ? (
        <div className="space-y-4">
          <EmptyState
            icon={ListChecks}
            title="还没有提示词"
            description="先加几条真实用户会问的问题，或者直接使用下面的示例。"
            action={
              <div className="flex flex-wrap justify-center gap-2">
                <Button
                  onClick={() => {
                    setEditing(null);
                    setDialogOpen(true);
                  }}
                >
                  <Plus />
                  添加提示词
                </Button>
                <Button variant="outline" onClick={() => setImportOpen(true)}>
                  <Upload />
                  批量导入
                </Button>
              </div>
            }
          />
          <Card>
            <CardContent className="space-y-3 p-5">
              <div className="text-sm font-medium">示例提示词</div>
              <div className="flex flex-col gap-2">
                {suggestions.map((suggestion) => (
                  <div
                    key={suggestion.text}
                    className="flex flex-col gap-2 rounded-lg border p-3 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <span className="text-sm">{suggestion.text}</span>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => addSuggestion(suggestion.text, suggestion.tags)}
                    >
                      <Plus />
                      添加
                    </Button>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      ) : (
        <Card className="overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="min-w-[320px]">提示词</TableHead>
                <TableHead>标签</TableHead>
                <TableHead>状态</TableHead>
                <TableHead className="text-right">最近提及率</TableHead>
                <TableHead className="w-12" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {prompts.map((prompt) => {
                const metric = metrics.find((item) => item.promptId === prompt.id);
                return (
                  <TableRow key={prompt.id}>
                    <TableCell className="whitespace-normal">
                      <div className="line-clamp-2 text-sm">{prompt.text}</div>
                      {prompt.note && (
                        <div className="mt-0.5 text-[11px] text-muted-foreground">{prompt.note}</div>
                      )}
                    </TableCell>
                    <TableCell>
                      <TagList tags={prompt.tags} />
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="secondary"
                        className={
                          prompt.enabled
                            ? "bg-emerald-500/12 text-emerald-600 dark:text-emerald-400"
                            : "bg-muted text-muted-foreground"
                        }
                      >
                        {prompt.enabled ? "启用" : "停用"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right text-xs tabular-nums">
                      {metric && metric.probeCount > 0 ? formatPercent(metric.mentionRate) : "—"}
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger
                          render={
                            <Button variant="ghost" size="icon-sm" aria-label="更多操作">
                              <MoreHorizontal />
                            </Button>
                          }
                        />
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            onClick={() => {
                              setEditing(prompt);
                              setDialogOpen(true);
                            }}
                          >
                            <Pencil className="size-3.5" />
                            编辑
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            variant="destructive"
                            onClick={() => setDeleting(prompt)}
                          >
                            <Trash2 className="size-3.5" />
                            删除
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </Card>
      )}

      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        <span>共 {prompts.length} 条</span>
        <span>·</span>
        <span>{prompts.filter((prompt) => prompt.enabled).length} 条启用</span>
        <span>·</span>
        <button className="hover:text-foreground" onClick={() => router.push("/run/")}>
          去运行探测 →
        </button>
      </div>

      <PromptDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        projectId={project.id}
        prompt={editing}
      />
      <ImportDialog
        open={importOpen}
        onOpenChange={setImportOpen}
        projectId={project.id}
        existingPrompts={prompts}
      />

      <AlertDialog open={!!deleting} onOpenChange={(open) => !open && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>删除这条提示词？</AlertDialogTitle>
            <AlertDialogDescription>
              历史批次里的回答和指标不会受影响，但以后运行不会再包含它。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>删除</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
