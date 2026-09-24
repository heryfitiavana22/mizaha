import type { RateLimiter, RateLimitResult } from "./rate-limiter";

export class InMemoryRateLimiter implements RateLimiter {
  private readonly hits = new Map<string, number[]>();

  constructor(
    private readonly maxRequests: number,
    private readonly windowMs: number,
    private readonly now: () => number = Date.now,
  ) {}

  async tryAcquire(key: string): Promise<RateLimitResult> {
    const now = this.now();
    const recent = (this.hits.get(key) ?? []).filter(
      (t) => t > now - this.windowMs,
    );

    if (recent.length < this.maxRequests) {
      recent.push(now);
      this.hits.set(key, recent);
      return { allowed: true, retryAfterMs: 0 };
    }

    this.hits.set(key, recent);
    return { allowed: false, retryAfterMs: recent[0] + this.windowMs - now };
  }
}
