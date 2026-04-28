import type { LLMProvider } from "@/lib/providers/interfaces/llm";
import type { Result, SearchCriteria } from "@/types";

type ExtractCriteriaOptions = {
  rawQuery: string;
  useCase: string;
  llm: LLMProvider;
  uiCriteria?: Record<string, unknown>;
};

export async function extractCriteria({
  rawQuery,
  useCase,
  llm,
  uiCriteria,
}: ExtractCriteriaOptions): Promise<Result<SearchCriteria>> {
  return llm.extractCriteria({ rawQuery, useCase, uiCriteria });
}
