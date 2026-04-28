"use client";

import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { ChevronDown } from "lucide-react";
import { PipelineStepItem } from "./pipeline-step-item";
import { STEP_ORDER } from "./types";
import type { PipelineRun } from "./types";

type PipelineStepsProps = {
  runs: PipelineRun[];
};

export function PipelineSteps({ runs }: PipelineStepsProps) {
  const byStep = Object.fromEntries(runs.map((run) => [run.step, run]));

  return (
    <Collapsible defaultOpen>
      <CollapsibleTrigger className="flex items-center gap-2 text-sm font-semibold hover:text-foreground transition-colors group">
        <ChevronDown className="size-4 transition-transform group-data-[state=closed]:-rotate-90" />
        Étapes du pipeline
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="mt-3 flex flex-col divide-y divide-border">
          {STEP_ORDER.map((step, index) => (
            <PipelineStepItem
              key={step}
              step={step}
              index={index}
              run={byStep[step]}
            />
          ))}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
