import { Badge } from "@/components/ui/badge";
import { SOURCE_CHANNEL_LABELS, SOURCE_OWNERSHIP_LABELS } from "@/lib/config";
import type { SourceChannel, SourceOwnership } from "@/lib/types";
import { cn } from "cn";

const OWNERSHIP_CLASS: Record<SourceOwnership, string> = {
  owned: "bg-emerald-500/12 text-emerald-600 dark:text-emerald-400 border-transparent",
  competitor: "bg-amber-500/12 text-amber-600 dark:text-amber-400 border-transparent",
  third_party: "bg-muted text-muted-foreground border-transparent",
};

export function OwnershipBadge({
  ownership,
  className,
}: {
  ownership: SourceOwnership;
  className?: string;
}) {
  return (
    <Badge variant="secondary" className={cn("font-normal", OWNERSHIP_CLASS[ownership], className)}>
      {SOURCE_OWNERSHIP_LABELS[ownership]}
    </Badge>
  );
}

export function ChannelBadge({
  channel,
  className,
}: {
  channel: SourceChannel;
  className?: string;
}) {
  return (
    <Badge variant="outline" className={cn("font-normal text-muted-foreground", className)}>
      {SOURCE_CHANNEL_LABELS[channel]}
    </Badge>
  );
}
