import FirecrawlApp from "@mendable/firecrawl-js";
import { env } from "@/env";
import logger from "@/lib/logger";
import type {
  ScraperProvider,
  ScrapedContent,
} from "@/lib/providers/interfaces/scraper";
import type { Result } from "@/types";
import { type RateLimitedExecutor } from "@/lib/rate-limit/rate-limited-executor";

export class FirecrawlScraperProvider implements ScraperProvider {
  readonly name = "firecrawl-scraper";
  private readonly client = new FirecrawlApp({ apiKey: env.FIRECRAWL_API_KEY });

  constructor(private readonly executor: RateLimitedExecutor) {}

  async scrape(url: string): Promise<Result<ScrapedContent>> {
    const start = Date.now();

    try {
      const response = await this.executor.execute(
        () => this.client.scrape(url, { formats: ["markdown"] }),
        {
          onRetry: (info) =>
            logger.warn(
              { provider: this.name, method: "scrape", url, ...info },
              "Rate limit hit, retrying",
            ),
        },
      );

      const content: ScrapedContent = {
        url,
        title: response.metadata?.title ?? "",
        content: response.markdown ?? "",
        metadata: Object.fromEntries(
          Object.entries(response.metadata ?? {})
            .filter(([, v]) => typeof v === "string")
            .map(([k, v]) => [k, v as string]),
        ),
      };

      logger.info(
        {
          provider: this.name,
          method: "scrape",
          durationMs: Date.now() - start,
          status: "success",
          url,
        },
        "API call completed",
      );

      return { success: true, data: content };
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      logger.error(
        {
          provider: this.name,
          method: "scrape",
          durationMs: Date.now() - start,
          status: "error",
          url,
          error: err.message,
        },
        "API call failed",
      );
      return { success: false, error: err };
    }
  }
}
