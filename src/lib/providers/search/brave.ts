import { env } from "@/env";
import logger from "@/lib/logger";
import type {
  SearchInput,
  SearchProvider,
} from "@/lib/providers/interfaces/search";
import type { Result, SearchResult } from "@/types";

const BASE_URL = "https://api.search.brave.com/res/v1/web/search";
const DEFAULT_SEARCH_LIMIT = 10;

type BraveResult = {
  url: string;
  title: string;
  description: string;
};

type BraveResponse = {
  web?: { results?: BraveResult[] };
};

function isBraveResponse(data: unknown): data is BraveResponse {
  return typeof data === "object" && data !== null;
}

export class BraveSearchProvider implements SearchProvider {
  async search({
    query,
    options,
  }: SearchInput): Promise<Result<SearchResult[]>> {
    const start = Date.now();

    try {
      const params = new URLSearchParams({
        q: query,
        count: String(options?.limit ?? DEFAULT_SEARCH_LIMIT),
      });
      if (options?.country) params.set("country", options.country);

      const response = await fetch(`${BASE_URL}?${params}`, {
        headers: {
          "X-Subscription-Token": env.BRAVE_SEARCH_API_KEY,
          Accept: "application/json",
          "Accept-Encoding": "gzip",
        },
      });

      if (!response.ok) {
        throw new Error(`Brave Search API responded with ${response.status}`);
      }

      const data: unknown = await response.json();

      if (!isBraveResponse(data)) {
        throw new Error("Unexpected Brave Search response shape");
      }

      const results: SearchResult[] = (data.web?.results ?? []).map((r) => ({
        url: r.url,
        title: r.title,
        snippet: r.description,
      }));

      logger.info(
        {
          provider: "brave",
          method: "search",
          durationMs: Date.now() - start,
          status: "success",
          count: results.length,
        },
        "API call completed",
      );

      return { success: true, data: results };
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      logger.error(
        {
          provider: "brave",
          method: "search",
          durationMs: Date.now() - start,
          status: "error",
          error: err.message,
        },
        "API call failed",
      );
      return { success: false, error: err };
    }
  }
}
