export interface RetryOptions {
  maxAttempts?: number;
  baseDelayMs?: number;
  maxDelayMs?: number;
  shouldRetry?: (error: unknown, attempt: number) => boolean;
}

export interface RetryResult<T> {
  value: T;
  attempts: number;
}

function sleep(delayMs: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, delayMs);
  });
}

function nextDelay(base: number, max: number, attempt: number): number {
  const jitter = Math.floor(Math.random() * 25);
  return Math.min(max, base * 2 ** (attempt - 1) + jitter);
}

export async function retryTransient<T>(
  operation: (attempt: number) => Promise<T>,
  options: RetryOptions = {}
): Promise<RetryResult<T>> {
  const maxAttempts = options.maxAttempts ?? 3;
  const baseDelayMs = options.baseDelayMs ?? 200;
  const maxDelayMs = options.maxDelayMs ?? 2_000;
  const shouldRetry =
    options.shouldRetry ??
    ((error: unknown) => {
      if (typeof error === "object" && error !== null && "retryable" in error) {
        return Boolean((error as { retryable?: boolean }).retryable);
      }
      return true;
    });

  let lastError: unknown;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      const value = await operation(attempt);
      return { value, attempts: attempt };
    } catch (error) {
      lastError = error;
      const retryable = shouldRetry(error, attempt);
      const hasNextAttempt = attempt < maxAttempts;

      if (!retryable || !hasNextAttempt) {
        throw lastError;
      }

      const delay = nextDelay(baseDelayMs, maxDelayMs, attempt);
      await sleep(delay);
    }
  }

  throw lastError instanceof Error ? lastError : new Error("retryTransient exhausted unexpectedly");
}
