"use client";

import { useMemo, useState } from "react";
import { ArrowUpRight, ListOrdered } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { NativeSelect } from "@/components/ui/native-select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { EmptyState } from "@/components/empty-state";
import type { Probe, Prompt } from "@/lib/types";

export function LeaderboardTab({
  probes,
  prompts,
  onOpenProbe,
}: {
  probes: Probe[];
  prompts: Prompt[];
  onOpenProbe: (probeId: string) => void;
}) {
  const candidates = useMemo(
    () => probes.filter((probe) => probe.listItems.length >= 2),
    [probes],
  );
  const [selectedId, setSelectedId] = useState<string>("");
  const selected = candidates.find((probe) => probe.id === selectedId) ?? candidates[0];

  if (!candidates.length) {
    return (
      <EmptyState
        icon={ListOrdered}
        title="没有解析出榜单"
        description="AI 的回答里没有编号/项目符号列表，或者列表不是公司推荐。打开探测明细可以看完整回答。"
      />
    );
  }

  const promptIndex = selected
    ? prompts.findIndex((prompt) => prompt.id === selected.promptId) + 1
    : 0;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex flex-col gap-3 pb-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle className="text-base">AI 推荐榜</CardTitle>
            <p className="mt-1 text-xs text-muted-foreground">
              从回答的编号/项目符号里解析，自动匹配追踪目标
            </p>
          </div>
          <NativeSelect
            value={selected?.id ?? ""}
            onChange={(event) => setSelectedId(event.target.value)}
            className="w-full sm:w-[420px]"
          >
            {candidates.map((probe) => {
              const index = prompts.findIndex((prompt) => prompt.id === probe.promptId) + 1;
              return (
                <option key={probe.id} value={probe.id}>
                  P{index} · 第 {probe.repeatIndex} 次 · {probe.promptText.slice(0, 34)}
                </option>
              );
            })}
          </NativeSelect>
        </CardHeader>
        <CardContent className="space-y-4">
          {selected && (
            <>
              <div className="rounded-lg border bg-muted/20 p-3">
                <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  <Badge variant="outline" className="font-normal">
                    P{promptIndex}
                  </Badge>
                  <span className="line-clamp-2 text-foreground">{selected.promptText}</span>
                  <span>· 第 {selected.repeatIndex} 次</span>
                  {selected.mentions.length > 0 && (
                    <span>
                      · 命中：
                      {selected.mentions.map((mention) => mention.targetLabel).join("、")}
                    </span>
                  )}
                </div>
              </div>

              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-16">位次</TableHead>
                    <TableHead>公司 / 标题</TableHead>
                    <TableHead className="w-32">追踪</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {selected.listItems.map((item) => (
                    <TableRow key={`${item.index}-${item.title}`}>
                      <TableCell className="font-mono text-xs text-muted-foreground">
                        {item.index}
                      </TableCell>
                      <TableCell className="whitespace-normal text-sm">{item.title}</TableCell>
                      <TableCell>
                        {item.matchedLabel ? (
                          <Badge variant="secondary" className="font-normal">
                            {item.matchedLabel}
                          </Badge>
                        ) : (
                          <span className="text-xs text-muted-foreground">未追踪</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              {selected.otherEntities.length > 0 && (
                <div className="space-y-2">
                  <div className="text-xs font-medium text-muted-foreground">其他被提到的公司</div>
                  <div className="flex flex-wrap gap-1.5">
                    {selected.otherEntities.map((entity) => (
                      <Badge key={entity} variant="outline" className="font-normal">
                        {entity}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex items-center justify-between">
                <p className="text-[11px] text-muted-foreground">
                  自动解析，仅供参考；以完整回答为准。
                </p>
                <Button variant="outline" size="sm" onClick={() => onOpenProbe(selected.id)}>
                  打开完整回答
                  <ArrowUpRight />
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
