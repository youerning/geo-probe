import Link from "next/link";
import { Radar } from "lucide-react";
import { cn } from "cn";
import { APP_NAME } from "@/lib/config";

export function Logo({
  compact = false,
  className,
}: {
  compact?: boolean;
  className?: string;
}) {
  return (
    <Link href="/" className={cn("flex items-center gap-2.5", className)}>
      <span className="relative flex size-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-chart-1 to-chart-2 text-white shadow-sm">
        <Radar className="size-5" />
        <span className="absolute inset-0 rounded-xl ring-1 ring-inset ring-white/20" />
      </span>
      <span className="flex min-w-0 flex-col">
        <span className="truncate text-sm font-semibold tracking-tight">{APP_NAME}</span>
        {!compact && (
          <span className="truncate text-[11px] text-muted-foreground">
            AI 搜索品牌提及检测
          </span>
        )}
      </span>
    </Link>
  );
}
