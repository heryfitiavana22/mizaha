import type { Result, SearchResult } from "@/types";

export type SearchOptions = {
  country?: string;
  limit?: number;
};

export type SearchInput = {
  query: string;
  options?: SearchOptions;
};

export interface SearchProvider {
  search(input: SearchInput): Promise<Result<SearchResult[]>>;
}
