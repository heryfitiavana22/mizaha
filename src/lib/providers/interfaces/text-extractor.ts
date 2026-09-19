import type { Result, SearchCriteria, SearchResult } from "@/types";

export type ExtractCriteriaInput = {
  rawQuery: string;
  useCase: string;
  uiCriteria?: Record<string, unknown>;
};

export interface TextExtractorProvider {
  readonly name: string;
  extractCriteria(input: ExtractCriteriaInput): Promise<Result<SearchCriteria>>;
  extractCompanyNames(results: SearchResult[]): Promise<Result<string[]>>;
}
