export interface RateLimitResult {
  allowed: boolean;
  /** Délai (ms) avant qu'une nouvelle tentative ait une chance de passer. 0 si allowed. */
  retryAfterMs: number;
}

export interface RateLimiter {
  /** Tente de consommer un slot, sans jamais attendre. */
  tryAcquire(key: string): Promise<RateLimitResult>;
}
