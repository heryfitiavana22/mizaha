import { Redis } from "@upstash/redis";
import { env } from "@/env";
import { RateLimitedExecutor } from "./rate-limited-executor";
import { UpstashRateLimiter } from "./upstash-rate-limiter";

const getErrorMessage = (e: unknown) =>
  e instanceof Error ? e.message : String(e);

export function createFirecrawlExecutor(): RateLimitedExecutor {
  const limiter = new UpstashRateLimiter({
    redis: new Redis({
      url: env.UPSTASH_REDIS_REST_URL,
      token: env.UPSTASH_REDIS_REST_TOKEN,
    }),
    maxRequests: 90,
    windowSeconds: 60,
    prefix: "ratelimit:firecrawl",
  });

  return new RateLimitedExecutor(limiter, {
    key: "global",
    maxTotalWaitMs: 360_000,
    maxRetries: 3,
    baseDelayMs: 5_000,
    maxJitterMs: 500,
    isRateLimitError: (error) =>
      (typeof error === "object" &&
        error !== null &&
        (error as { status?: unknown }).status === 429) ||
      /rate limit exceeded|\b429\b/i.test(getErrorMessage(error)),
    getRetryAfterMs: (error) => {
      const match = getErrorMessage(error).match(/retry after (\d+)\s*s/i);
      return match ? Number(match[1]) * 1000 : null;
    },
  });
}
