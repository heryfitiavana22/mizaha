import type { RateLimiter } from "./rate-limiter";

export class RateLimitTimeoutError extends Error {
  constructor(message = "Rate limit: max wait time exceeded (queue full)") {
    super(message);
    this.name = "RateLimitTimeoutError";
  }
}

export interface RateLimitedExecutorConfig {
  /** Key passed to the limiter (e.g. "global"). */
  key: string;
  /** Total max wait (slots + retries). Must stay < function maxDuration. */
  maxTotalWaitMs: number;
  maxRetries: number;
  /** Base delay for exponential backoff when the service does not provide retry-after. */
  baseDelayMs: number;
  maxJitterMs: number;
  /** Did the remote service respond with a rate limit? */
  isRateLimitError: (error: unknown) => boolean;
  /** Extracts the delay imposed by the remote service, or null. */
  getRetryAfterMs?: (error: unknown) => number | null;
}

export interface RetryInfo {
  attempt: number;
  maxRetries: number;
  retryInMs: number;
}

const sleep = (ms: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, ms));

export class RateLimitedExecutor {
  constructor(
    private readonly limiter: RateLimiter,
    private readonly config: RateLimitedExecutorConfig,
    private readonly wait: (ms: number) => Promise<void> = sleep,
  ) {}

  async execute<T>(
    fn: () => Promise<T>,
    options: { onRetry?: (info: RetryInfo) => void } = {},
  ): Promise<T> {
    const {
      maxRetries,
      baseDelayMs,
      maxTotalWaitMs,
      isRateLimitError,
      getRetryAfterMs,
    } = this.config;
    const deadline = Date.now() + maxTotalWaitMs;

    for (let attempt = 0; ; attempt++) {
      await this.acquireSlot(deadline);

      try {
        return await fn();
      } catch (error) {
        if (!isRateLimitError(error) || attempt >= maxRetries) throw error;

        const retryAfterMs = getRetryAfterMs?.(error) ?? null;
        const delayMs =
          (retryAfterMs !== null
            ? retryAfterMs + 1_000
            : baseDelayMs * 2 ** attempt) + this.jitter();

        if (Date.now() + delayMs > deadline) throw error;

        options.onRetry?.({
          attempt: attempt + 1,
          maxRetries,
          retryInMs: Math.round(delayMs),
        });
        await this.wait(delayMs);
      }
    }
  }

  private async acquireSlot(deadline: number): Promise<void> {
    for (;;) {
      const { allowed, retryAfterMs } = await this.limiter.tryAcquire(
        this.config.key,
      );
      if (allowed) return;

      const waitMs = Math.max(retryAfterMs, 250) + this.jitter();
      if (Date.now() + waitMs > deadline) throw new RateLimitTimeoutError();

      await this.wait(waitMs);
    }
  }

  private jitter(): number {
    return Math.random() * this.config.maxJitterMs;
  }
}
