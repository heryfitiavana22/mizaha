import type { EntityScorerProvider, QualifyInput } from "./entity-scorer";
import type {
  ExtractCriteriaInput,
  TextExtractorProvider,
} from "./text-extractor";

export type { ExtractCriteriaInput, QualifyInput };

export type LLMProvider = TextExtractorProvider & EntityScorerProvider;
