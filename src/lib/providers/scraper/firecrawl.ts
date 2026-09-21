import FirecrawlApp from "@mendable/firecrawl-js";
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import { env } from "@/env";
import logger from "@/lib/logger";
import type {
  ScraperProvider,
  ScrapedContent,
} from "@/lib/providers/interfaces/scraper";
import type { Result } from "@/types";

const MAX_REQUESTS_PER_MINUTE = 70;
/** Maximum retries when Firecrawl still returns a 429. */
const MAX_RETRIES = 3;
/** Base exponential-backoff delay when Firecrawl does not provide a retry-after value. */
const BASE_DELAY_MS = 5_000;
/**
 * Maximum total wait time (slot acquisition plus retries) for one request.
 * Must remain below the Vercel function's maxDuration.
 */
const MAX_TOTAL_WAIT_MS = 360_000;
const MAX_JITTER_MS = 500;

const sleep = (ms: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, ms));

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function isRateLimitError(error: unknown): boolean {
  if (
    typeof error === "object" &&
    error !== null &&
    "status" in error &&
    (error as { status?: unknown }).status === 429
  ) {
    return true;
  }
  return /rate limit exceeded|\b429\b/i.test(getErrorMessage(error));
}

/** Extracts "retry after 57s" from a Firecrawl message in milliseconds, or null. */
function parseRetryAfterMs(error: unknown): number | null {
  const match = getErrorMessage(error).match(/retry after (\d+)\s*s/i);
  return match ? Number(match[1]) * 1000 : null;
}

export class FirecrawlScraperProvider implements ScraperProvider {
  readonly name = "firecrawl-scraper";
  private readonly client: FirecrawlApp;
  private readonly limiter: Ratelimit;

  constructor() {
    this.client = new FirecrawlApp({ apiKey: env.FIRECRAWL_API_KEY });
    this.limiter = new Ratelimit({
      redis: new Redis({
        url: env.UPSTASH_REDIS_REST_URL,
        token: env.UPSTASH_REDIS_REST_TOKEN,
      }),
      limiter: Ratelimit.slidingWindow(MAX_REQUESTS_PER_MINUTE, "60 s"),
      prefix: "ratelimit:firecrawl",
    });
  }

  /**
   * Waits until a slot is available in the shared rate limiter.
   * Throws if waiting would exceed the deadline.
   */
  private async acquireSlot(deadline: number): Promise<void> {
    for (;;) {
      const { success, reset } = await this.limiter.limit("global");
      if (success) return;

      const waitMs =
        Math.max(reset - Date.now(), 250) + Math.random() * MAX_JITTER_MS;

      if (Date.now() + waitMs > deadline) {
        throw new Error(
          "Firecrawl rate limit: temps d'attente maximal dépassé (file saturée)",
        );
      }
      await sleep(waitMs);
    }
  }

  /**
   * Executes a Firecrawl call:
   * 1. acquires a slot in the Redis rate limiter (prevention)
   * 2. if Firecrawl still returns a 429, waits for the indicated delay
   *    (or uses exponential backoff) before retrying (safety net)
   */
  private async withRateLimitRetry<T>(
    method: string,
    url: string,
    fn: () => Promise<T>,
  ): Promise<T> {
    const deadline = Date.now() + MAX_TOTAL_WAIT_MS;

    for (let attempt = 0; ; attempt++) {
      await this.acquireSlot(deadline);

      try {
        return await fn();
      } catch (error) {
        if (!isRateLimitError(error) || attempt >= MAX_RETRIES) {
          throw error;
        }

        const retryAfterMs = parseRetryAfterMs(error);
        const delayMs =
          (retryAfterMs !== null
            ? retryAfterMs + 1_000 // Small safety margin
            : BASE_DELAY_MS * 2 ** attempt) +
          Math.random() * MAX_JITTER_MS;

        if (Date.now() + delayMs > deadline) {
          throw error;
        }

        logger.warn(
          {
            provider: this.name,
            method,
            url,
            attempt: attempt + 1,
            maxRetries: MAX_RETRIES,
            retryInMs: Math.round(delayMs),
          },
          "Rate limit hit, retrying",
        );

        await sleep(delayMs);
      }
    }
  }

  async scrape(url: string): Promise<Result<ScrapedContent>> {
    const start = Date.now();

    try {
      const response = await this.withRateLimitRetry("scrape", url, () =>
        this.client.scrape(url, { formats: ["markdown"] }),
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
