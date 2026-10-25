"use client";

import { Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MAX_COMPETITORS, type CompetitorDraft } from "@/lib/project-utils";

export function CompetitorEditor({
  value,
  onChange,
  idPrefix = "competitor",
}: {
  value: CompetitorDraft[];
  onChange: (value: CompetitorDraft[]) => void;
  idPrefix?: string;
}) {
  const update = (index: number, patch: Partial<CompetitorDraft>) => {
    onChange(
      value.map((draft, itemIndex) => (itemIndex === index ? { ...draft, ...patch } : draft)),
    );
  };

  const remove = (index: number) => {
    onChange(value.filter((_, itemIndex) => itemIndex !== index));
  };

  const add = () => {
    if (value.length >= MAX_COMPETITORS) return;
    onChange([...value, { label: "", aliases: "", domains: "" }]);
  };

  return (
    <div className="space-y-3">
      {value.length === 0 && (
        <p className="rounded-lg border border-dashed px-3 py-4 text-center text-xs text-muted-foreground">
          还没有竞品。添加后可以对比品牌与竞品的 AI 提及情况。
        </p>
      )}

      {value.map((draft, index) => {
        const rowId = `${idPrefix}-${index}`;
        return (
          <div key={rowId} className="space-y-2 rounded-lg border p-3">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-medium text-muted-foreground">竞品 {index + 1}</span>
              <Button
                type="button"
                variant="ghost"
                size="icon-xs"
                aria-label={`删除竞品 ${index + 1}`}
                onClick={() => remove(index)}
              >
                <X />
              </Button>
            </div>
            <div className="grid gap-2 sm:grid-cols-3">
              <div className="space-y-1">
                <Label htmlFor={`${rowId}-label`} className="text-xs text-muted-foreground">
                  显示名
                </Label>
                <Input
                  id={`${rowId}-label`}
                  value={draft.label}
                  onChange={(event) => update(index, { label: event.target.value })}
                  placeholder="例如：纳基GEO"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor={`${rowId}-aliases`} className="text-xs text-muted-foreground">
                  别名（可选）
                </Label>
                <Input
                  id={`${rowId}-aliases`}
                  value={draft.aliases}
                  onChange={(event) => update(index, { aliases: event.target.value })}
                  placeholder="多个用逗号分隔"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor={`${rowId}-domains`} className="text-xs text-muted-foreground">
                  域名（可选）
                </Label>
                <Input
                  id={`${rowId}-domains`}
                  value={draft.domains}
                  onChange={(event) => update(index, { domains: event.target.value })}
                  placeholder="例如：example.com"
                />
              </div>
            </div>
          </div>
        );
      })}

      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground">
          只填显示名也可以；别名和域名可选，多个用逗号分隔。
        </p>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={add}
          disabled={value.length >= MAX_COMPETITORS}
        >
          <Plus />
          {value.length >= MAX_COMPETITORS ? "已达 5 个上限" : "添加竞品"}
        </Button>
      </div>
    </div>
  );
}
