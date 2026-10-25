import { Badge } from "@/components/ui/badge";
import { PROMPT_TAG_MAP } from "@/lib/config";
import { cn } from "cn";

export function TagBadge({ tag, className }: { tag: string; className?: string }) {
  const meta = PROMPT_TAG_MAP[tag];
  return (
    <Badge
      variant="outline"
      className={cn("font-normal", meta?.badgeClass, !meta && "text-muted-foreground", className)}
    >
      {meta?.label ?? tag}
    </Badge>
  );
}

export function TagList({ tags, className }: { tags: string[]; className?: string }) {
  if (!tags.length) return null;
  return (
    <div className={cn("flex flex-wrap gap-1", className)}>
      {tags.map((tag) => (
        <TagBadge key={tag} tag={tag} />
      ))}
    </div>
  );
}
