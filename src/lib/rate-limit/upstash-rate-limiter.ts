import { Ratelimit } from "@upstash/ratelimit";
import type { Redis } from "@upstash/redis";
import type { RateLimiter, RateLimitResult } from "./rate-limiter";

interface UpstashRateLimiterOptions {
  redis: Redis;
  maxRequests: number;
  windowSeconds: number;
  prefix: string;
}

export class UpstashRateLimiter implements RateLimiter {
  private readonly limiter: Ratelimit;

  constructor({
    redis,
    maxRequests,
    windowSeconds,
    prefix,
  }: UpstashRateLimiterOptions) {
    this.limiter = new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(maxRequests, `${windowSeconds} s`),
      prefix,
    });
  }

  async tryAcquire(key: string): Promise<RateLimitResult> {
    const { success, reset } = await this.limiter.limit(key);
    return {
      allowed: success,
      retryAfterMs: success ? 0 : Math.max(reset - Date.now(), 0),
    };
  }
}
