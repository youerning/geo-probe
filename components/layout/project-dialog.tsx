"use client";

import { useState } from "react";
import { Loader2, Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { createProject } from "@/lib/db/repositories";
import { useAppStore } from "@/lib/hooks/use-app-store";
import type { Project } from "@/lib/types";
import { buildBrandTarget, parseCompetitors } from "@/lib/project-utils";

export function ProjectDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated?: (project: Project) => void;
}) {
  const setSelectedProjectId = useAppStore((state) => state.setSelectedProjectId);
  const [name, setName] = useState("");
  const [brand, setBrand] = useState("");
  const [aliases, setAliases] = useState("");
  const [domains, setDomains] = useState("");
  const [competitors, setCompetitors] = useState("");
  const [saving, setSaving] = useState(false);

  const reset = () => {
    setName("");
    setBrand("");
    setAliases("");
    setDomains("");
    setCompetitors("");
  };

  const handleCreate = async () => {
    const brandLabel = brand.trim();
    if (!brandLabel) {
      toast.error("请填写品牌/公司名。");
      return;
    }

    setSaving(true);
    try {
      const brandTarget = buildBrandTarget(brandLabel, aliases, domains);

      const project = await createProject({
        name: name.trim() || `${brandLabel} GEO 监测`,
        brand: brandTarget,
        competitors: parseCompetitors(competitors),
        locale: "zh-CN",
        isDemo: false,
      });

      setSelectedProjectId(project.id);
      onCreated?.(project);
      toast.success("项目已创建。");
      reset();
      onOpenChange(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "创建失败。");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>新建项目</DialogTitle>
          <DialogDescription>
            一个项目对应一个品牌。别名越全，提及检测越准；竞品最多 5 个。
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="project-name">项目名</Label>
            <Input
              id="project-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="例如：元构场 GEO 监测"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="brand-name">品牌/公司名 *</Label>
            <Input
              id="brand-name"
              value={brand}
              onChange={(event) => setBrand(event.target.value)}
              placeholder="例如：元构场"
            />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="brand-aliases">品牌别名</Label>
            <Textarea
              id="brand-aliases"
              value={aliases}
              onChange={(event) => setAliases(event.target.value)}
              placeholder="公司全称、简称、产品名、英文名，用逗号或换行分隔"
              rows={2}
            />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="brand-domains">官网域名</Label>
            <Input
              id="brand-domains"
              value={domains}
              onChange={(event) => setDomains(event.target.value)}
              placeholder="例如：yuangouchang.com（多个用逗号分隔）"
            />
            <p className="text-xs text-muted-foreground">
              用于统计“官网是否进入检索来源”。只填主域名，不要带 https://。
            </p>
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="competitors">竞品（每行一个）</Label>
            <Textarea
              id="competitors"
              value={competitors}
              onChange={(event) => setCompetitors(event.target.value)}
              placeholder={"竞品 A | 别名1,别名2 | 域名\n竞品 B | 别名1,别名2 | 域名"}
              rows={4}
            />
            <p className="text-xs text-muted-foreground">
              格式：显示名 | 别名（逗号分隔） | 域名（可选）。最多 5 个。
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            取消
          </Button>
          <Button onClick={handleCreate} disabled={saving}>
            {saving ? <Loader2 className="animate-spin" /> : <Plus />}
            创建项目
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
