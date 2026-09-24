export interface RateLimitResult {
  allowed: boolean;
  /** Delay (ms) before a new attempt has a chance to succeed. 0 if allowed. */
  retryAfterMs: number;
}

export interface RateLimiter {
  /** Attempts to consume a slot without waiting. */
  tryAcquire(key: string): Promise<RateLimitResult>;
}
