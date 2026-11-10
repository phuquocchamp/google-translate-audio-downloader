export class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
    this.name = "HttpError";
  }
}

export interface RetryOptions {
  retries: number;
  baseDelayMs?: number;
  /** Delay base used when the server answers 429 (rate limited). */
  rateLimitDelayMs?: number;
  onRetry?: (err: unknown, attempt: number, waitMs: number) => void;
  sleep?: (ms: number) => Promise<void>;
}

export const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

function isRetryable(err: unknown): boolean {
  if (err instanceof HttpError) return err.status === 429 || err.status >= 500;
  // Network errors from fetch (TypeError: fetch failed), timeouts, etc.
  return err instanceof TypeError || (err as Error)?.name === "TimeoutError";
}

/** Exponential backoff with jitter. 429 gets a longer base (5s, 15s, 45s). */
export async function retry<T>(fn: () => Promise<T>, opts: RetryOptions): Promise<T> {
  const { retries, baseDelayMs = 1000, rateLimitDelayMs = 5000, onRetry, sleep: doSleep = sleep } = opts;
  for (let attempt = 0; ; attempt++) {
    try {
      return await fn();
    } catch (err) {
      if (attempt >= retries || !isRetryable(err)) throw err;
      const is429 = err instanceof HttpError && err.status === 429;
      const base = is429 ? rateLimitDelayMs * 3 ** attempt : baseDelayMs * 2 ** attempt;
      const waitMs = Math.round(base * (0.8 + Math.random() * 0.4));
      onRetry?.(err, attempt + 1, waitMs);
      await doSleep(waitMs);
    }
  }
}
