import type { ComponentType, ReactNode } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "cn";

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
}: {
  icon?: ComponentType<{ className?: string }>;
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <Card className={cn("border-dashed bg-card/60", className)}>
      <CardContent className="flex flex-col items-center justify-center gap-3 px-6 py-14 text-center">
        {Icon && (
          <div className="flex size-11 items-center justify-center rounded-xl bg-muted text-muted-foreground">
            <Icon className="size-5" />
          </div>
        )}
        <div className="space-y-1">
          <div className="text-sm font-medium">{title}</div>
          {description && (
            <p className="mx-auto max-w-md text-sm leading-6 text-muted-foreground">{description}</p>
          )}
        </div>
        {action}
      </CardContent>
    </Card>
  );
}
