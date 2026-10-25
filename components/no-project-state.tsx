"use client";

import { useState } from "react";
import { FolderPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/empty-state";
import { ProjectDialog } from "@/components/layout/project-dialog";

export function NoProjectState() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <EmptyState
        icon={FolderPlus}
        title="还没有项目"
        description="先创建一个项目，填入品牌、别名和竞品，再开始探测。"
        action={
          <Button onClick={() => setOpen(true)}>
            创建项目
          </Button>
        }
      />
      <ProjectDialog open={open} onOpenChange={setOpen} />
    </>
  );
}
