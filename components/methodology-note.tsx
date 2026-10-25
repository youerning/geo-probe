import { Info } from "lucide-react";
import { DISCLAIMER } from "@/lib/config";

export function MethodologyNote({ compact = false }: { compact?: boolean }) {
  return (
    <div className="flex gap-2.5 rounded-xl border bg-muted/30 p-4 text-xs leading-5 text-muted-foreground">
      <Info className="mt-0.5 size-4 shrink-0" />
      <div className="space-y-1">
        <p>
          <strong className="font-medium text-foreground">口径：</strong>
          “AI 引用”指回答中出现你的公司/产品名；“检索来源”指搜索工具返回的网页，不等于模型逐句引用。
        </p>
        {!compact && <p>{DISCLAIMER}</p>}
      </div>
    </div>
  );
}
