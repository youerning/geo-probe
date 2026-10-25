"use client";

import { Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Skeleton } from "@/components/ui/skeleton";
import { NoProjectState } from "@/components/no-project-state";
import { RunHistory } from "@/components/runs/run-history";
import { RunDetail } from "@/components/runs/run-detail";
import { useAppStore } from "@/lib/hooks/use-app-store";
import { useProject, useProjectProbes, useRuns } from "@/lib/hooks/use-data";

function HistoryPage() {
  const selectedProjectId = useAppStore((state) => state.selectedProjectId);
  const project = useProject(selectedProjectId);
  const runs = useRuns(project?.id);
  const probes = useProjectProbes(project?.id);

  if (!project) return <NoProjectState />;

  return (
    <RunHistory
      projectName={project.name}
      runs={runs}
      probes={probes}
      loading={runs === undefined || probes === undefined}
    />
  );
}

function RunsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const runId = searchParams.get("run");

  const updateParams = (patch: Record<string, string | null>) => {
    const params = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(patch)) {
      if (value === null || value === "") params.delete(key);
      else params.set(key, value);
    }
    const query = params.toString();
    router.replace(query ? `/runs/?${query}` : "/runs/", { scroll: false });
  };

  if (runId) {
    return (
      <RunDetail
        runId={runId}
        tab={searchParams.get("tab") ?? "overview"}
        promptId={searchParams.get("prompt")}
        probeId={searchParams.get("probe")}
        domain={searchParams.get("domain")}
        onUpdateParams={updateParams}
      />
    );
  }

  return <HistoryPage />;
}

export default function RunsPage() {
  return (
    <Suspense
      fallback={
        <div className="space-y-4">
          <Skeleton className="h-10 w-64" />
          <Skeleton className="h-64 rounded-xl" />
        </div>
      }
    >
      <RunsContent />
    </Suspense>
  );
}
