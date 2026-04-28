import type { FC } from "react";
import { ExtractCriteriaInput } from "./extract-criteria-input";
import { ExtractCriteriaOutput } from "./extract-criteria-output";
import { DiscoverInput } from "./discover-input";
import { DiscoverOutput } from "./discover-output";
import { QualifyInput } from "./qualify-input";
import { QualifyOutput } from "./qualify-output";
import { EnrichInput } from "./enrich-input";
import { EnrichOutput } from "./enrich-output";

type StepRenderer = FC<{ data: Record<string, unknown> }>;

export const INPUT_RENDERERS: Record<string, StepRenderer> = {
  "extract-criteria": ExtractCriteriaInput,
  discover: DiscoverInput,
  qualify: QualifyInput,
  enrich: EnrichInput,
};

export const OUTPUT_RENDERERS: Record<string, StepRenderer> = {
  "extract-criteria": ExtractCriteriaOutput,
  discover: DiscoverOutput,
  qualify: QualifyOutput,
  enrich: EnrichOutput,
};
