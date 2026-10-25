"use client";

import { useMemo, useRef, useState } from "react";
import Papa from "papaparse";
import { FileUp, Loader2, Upload } from "lucide-react";
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
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { MAX_PROMPT_COUNT, PROMPT_TAGS } from "@/lib/config";
import { createPrompt } from "@/lib/db/repositories";
import type { Prompt } from "@/lib/types";
import { uniq } from "@/lib/utils/array";
import { cn } from "cn";

type ParsedRow = { text: string; tags: string[] };

function splitTags(value: string): string[] {
  return value
    .split(/[,，、;；]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function parseRows(raw: string, csv: boolean): ParsedRow[] {
  if (!raw.trim()) return [];

  if (csv) {
    const result = Papa.parse<string[]>(raw.trim(), { skipEmptyLines: true });
    const rows = result.data.filter((row) => Array.isArray(row) && row.length > 0);
    if (!rows.length) return [];

    const header = rows[0].map((cell) => (cell ?? "").trim().toLowerCase());
    const promptIndex = header.findIndex((cell) => /prompt|提示词|问题|question/.test(cell));
    const tagIndex = header.findIndex((cell) => /tag|标签/.test(cell));
    const dataRows = promptIndex >= 0 ? rows.slice(1) : rows;
    const textIndex = promptIndex >= 0 ? promptIndex : 0;

    return dataRows
      .map((row) => ({
        text: (row[textIndex] ?? "").trim(),
        tags: tagIndex >= 0 ? splitTags(row[tagIndex] ?? "") : [],
      }))
      .filter((row) => row.text);
  }

  return raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((text) => ({ text, tags: [] }));
}

export function ImportDialog({
  open,
  onOpenChange,
  projectId,
  existingPrompts,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  existingPrompts: Prompt[];
}) {
  const [raw, setRaw] = useState("");
  const [isCsv, setIsCsv] = useState(false);
  const [fileName, setFileName] = useState("");
  const [defaultTags, setDefaultTags] = useState<string[]>(["general"]);
  const [importing, setImporting] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const existing = useMemo(
    () => new Set(existingPrompts.map((prompt) => prompt.text.trim().toLowerCase())),
    [existingPrompts],
  );

  const parsed = useMemo(() => {
    const rows = parseRows(raw, isCsv);
    const seen = new Set<string>();
    const duplicates: string[] = [];
    const unique: ParsedRow[] = [];

    for (const row of rows) {
      const key = row.text.trim().toLowerCase();
      if (existing.has(key) || seen.has(key)) {
        duplicates.push(row.text);
        continue;
      }
      seen.add(key);
      unique.push(row);
    }

    const slots = Math.max(0, MAX_PROMPT_COUNT - existingPrompts.length);
    return {
      rows: unique.slice(0, slots),
      duplicates,
      overflow: Math.max(0, unique.length - slots),
      total: rows.length,
    };
  }, [raw, isCsv, existing, existingPrompts.length]);

  const toggleTag = (tag: string) => {
    setDefaultTags((current) =>
      current.includes(tag) ? current.filter((item) => item !== tag) : [...current, tag],
    );
  };

  const handleFile = async (file?: File) => {
    if (!file) return;
    const text = await file.text();
    setRaw(text);
    setFileName(file.name);
    setIsCsv(file.name.toLowerCase().endsWith(".csv"));
  };

  const handleImport = async () => {
    if (!parsed.rows.length) {
      toast.error("没有可导入的提示词。");
      return;
    }

    setImporting(true);
    try {
      for (const row of parsed.rows) {
        await createPrompt({
          projectId,
          text: row.text,
          tags: uniq([...defaultTags, ...row.tags]),
          enabled: true,
        });
      }
      toast.success(`已导入 ${parsed.rows.length} 条提示词。`);
      setRaw("");
      setFileName("");
      onOpenChange(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "导入失败。");
    } finally {
      setImporting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>批量导入提示词</DialogTitle>
          <DialogDescription>
            粘贴一行一条，或上传 TXT / CSV。CSV 支持 `prompt, tags` 两列。重复项会自动跳过。
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <input
              ref={fileRef}
              type="file"
              accept=".txt,.csv,text/plain,text/csv"
              className="hidden"
              onChange={(event) => handleFile(event.target.files?.[0])}
            />
            <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()}>
              <FileUp />
              选择文件
            </Button>
            {fileName && <span className="text-xs text-muted-foreground">{fileName}</span>}
            <div className="ml-auto flex items-center gap-2">
              <Label htmlFor="csv-mode" className="text-xs text-muted-foreground">
                按 CSV 解析
              </Label>
              <Switch id="csv-mode" checked={isCsv} onCheckedChange={setIsCsv} />
            </div>
          </div>

          <Textarea
            value={raw}
            onChange={(event) => setRaw(event.target.value)}
            rows={7}
            placeholder={"推荐几家深圳做 GEO 优化的公司\n深圳 GEO 服务商哪家专业？\n元构场 GEO 服务怎么样？"}
            className="font-mono text-xs"
          />

          <div className="space-y-2">
            <Label>默认标签</Label>
            <div className="flex flex-wrap gap-2">
              {PROMPT_TAGS.map((tag) => (
                <button
                  key={tag.value}
                  type="button"
                  onClick={() => toggleTag(tag.value)}
                  className={cn(
                    "rounded-full border px-2.5 py-1 text-xs transition-colors",
                    defaultTags.includes(tag.value)
                      ? "border-primary/40 bg-primary/10 text-primary"
                      : "text-muted-foreground hover:bg-muted",
                  )}
                >
                  {tag.label}
                </button>
              ))}
            </div>
          </div>

          <div className="rounded-lg border bg-muted/30 p-3 text-xs text-muted-foreground">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <span>解析到 {parsed.total} 条</span>
              <span>可导入 {parsed.rows.length} 条</span>
              {parsed.duplicates.length > 0 && <span>重复 {parsed.duplicates.length} 条</span>}
              {parsed.overflow > 0 && <span>超出上限 {parsed.overflow} 条</span>}
              <span>最多 {MAX_PROMPT_COUNT} 条</span>
            </div>
            {parsed.rows.length > 0 && (
              <ul className="mt-2 space-y-1">
                {parsed.rows.slice(0, 4).map((row) => (
                  <li key={row.text} className="line-clamp-1">
                    · {row.text}
                  </li>
                ))}
                {parsed.rows.length > 4 && <li>…还有 {parsed.rows.length - 4} 条</li>}
              </ul>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={importing}>
            取消
          </Button>
          <Button onClick={handleImport} disabled={importing || !parsed.rows.length}>
            {importing ? <Loader2 className="animate-spin" /> : <Upload />}
            导入 {parsed.rows.length} 条
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
