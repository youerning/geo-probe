"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { PROMPT_TAGS } from "@/lib/config";
import { createPrompt, updatePrompt } from "@/lib/db/repositories";
import type { Prompt } from "@/lib/types";
import { cn } from "cn";

export function PromptDialog({
  open,
  onOpenChange,
  projectId,
  prompt,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  prompt?: Prompt | null;
}) {
  const [text, setText] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [note, setNote] = useState("");
  const [enabled, setEnabled] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setText(prompt?.text ?? "");
    setTags(prompt?.tags ?? []);
    setNote(prompt?.note ?? "");
    setEnabled(prompt?.enabled ?? true);
  }, [open, prompt]);

  const toggleTag = (tag: string) => {
    setTags((current) =>
      current.includes(tag) ? current.filter((item) => item !== tag) : [...current, tag],
    );
  };

  const handleSave = async () => {
    const value = text.trim();
    if (!value) {
      toast.error("请填写提示词。");
      return;
    }

    setSaving(true);
    try {
      if (prompt) {
        await updatePrompt(prompt.id, { text: value, tags, note: note.trim(), enabled });
        toast.success("提示词已更新。");
      } else {
        await createPrompt({
          projectId,
          text: value,
          tags,
          note: note.trim(),
          enabled,
        });
        toast.success("提示词已添加。");
      }
      onOpenChange(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "保存失败。");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{prompt ? "编辑提示词" : "添加提示词"}</DialogTitle>
          <DialogDescription>
            用真实用户会问 AI 的方式写，不要带引导词。例如“深圳做 GEO 优化的公司推荐”。
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="prompt-text">提示词 *</Label>
            <Textarea
              id="prompt-text"
              value={text}
              onChange={(event) => setText(event.target.value)}
              rows={4}
              placeholder="例如：深圳龙华有哪些靠谱的 AI 搜索优化服务商？"
            />
            <div className="text-right text-[11px] text-muted-foreground">{text.length} 字</div>
          </div>

          <div className="space-y-2">
            <Label>标签</Label>
            <div className="grid gap-2 sm:grid-cols-2">
              {PROMPT_TAGS.map((tag) => (
                <label
                  key={tag.value}
                  className={cn(
                    "flex cursor-pointer items-start gap-2 rounded-lg border p-2.5 transition-colors hover:bg-muted/50",
                    tags.includes(tag.value) && "border-primary/40 bg-primary/5",
                  )}
                >
                  <Checkbox
                    checked={tags.includes(tag.value)}
                    onCheckedChange={() => toggleTag(tag.value)}
                    className="mt-0.5"
                  />
                  <span className="min-w-0">
                    <span className="block text-xs font-medium">{tag.label}</span>
                    <span className="block text-[11px] leading-4 text-muted-foreground">
                      {tag.description}
                    </span>
                  </span>
                </label>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="prompt-note">备注（可选）</Label>
            <Input
              id="prompt-note"
              value={note}
              onChange={(event) => setNote(event.target.value)}
              placeholder="例如：品牌词基线、竞品对比"
            />
          </div>

          <div className="flex items-center justify-between rounded-lg border p-3">
            <div>
              <div className="text-sm font-medium">启用</div>
              <div className="text-[11px] text-muted-foreground">关闭后不会出现在默认运行列表里。</div>
            </div>
            <Switch checked={enabled} onCheckedChange={setEnabled} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            取消
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving && <Loader2 className="animate-spin" />}
            {prompt ? "保存修改" : "添加"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
