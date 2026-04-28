"use client";

import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Badge } from "@/components/ui/badge";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { DataSection } from "./data-section";
import { STEP_META } from "./types";
import type { PipelineRun } from "./types";

function formatDuration(ms: number | null): string {
  if (ms === null) return "";
  if (ms < 1000) return `${ms} ms`;
  return `${(ms / 1000).toFixed(1)} s`;
}

type PipelineStepItemProps = {
  step: string;
  index: number;
  run: PipelineRun | undefined;
};

export function PipelineStepItem({ step, index, run }: PipelineStepItemProps) {
  const meta = STEP_META[step];
  const status = run?.status ?? "pending";

  const dotClass = {
    completed: "bg-green-500",
    failed: "bg-destructive",
    running: "bg-blue-500 animate-pulse",
    pending: "bg-muted-foreground/30",
  }[status];

  return (
    <Collapsible defaultOpen={status !== "pending"}>
      <CollapsibleTrigger className="group flex w-full items-center gap-3 py-2 text-left hover:text-foreground transition-colors">
        <span className={cn("size-2 rounded-full shrink-0", dotClass)} />
        <span className="text-sm font-medium flex-1">
          {index + 1}. {meta?.label ?? step}
        </span>
        {run?.durationMs != null && (
          <span className="text-xs text-muted-foreground">
            {formatDuration(run.durationMs)}
          </span>
        )}
        <Badge
          variant={
            status === "completed"
              ? "default"
              : status === "failed"
                ? "destructive"
                : "secondary"
          }
          className="text-xs px-1.5 py-0"
        >
          {status === "completed"
            ? "OK"
            : status === "failed"
              ? "Erreur"
              : status === "running"
                ? "En cours"
                : "En attente"}
        </Badge>
        <ChevronDown
          className={cn(
            "size-3.5 shrink-0 transition-transform text-muted-foreground",
            "group-data-[state=closed]:-rotate-90",
          )}
        />
      </CollapsibleTrigger>

      <CollapsibleContent>
        <div className="ml-5 mb-3 flex flex-col gap-4 rounded-md border border-border bg-muted/30 p-3">
          {run?.error && (
            <div className="flex flex-col gap-1">
              <span className="text-xs font-semibold uppercase tracking-wide text-destructive">
                Erreur
              </span>
              <p className="text-xs text-destructive font-mono break-all bg-destructive/5 rounded px-2 py-1">
                {run.error}
              </p>
            </div>
          )}
          <DataSection
            label={meta?.inputLabel ?? "Entrée"}
            data={run?.inputData ?? null}
            step={step}
            kind="input"
          />
          {run?.status !== "failed" && (
            <DataSection
              label={meta?.outputLabel ?? "Sortie"}
              data={run?.outputData ?? null}
              step={step}
              kind="output"
            />
          )}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
