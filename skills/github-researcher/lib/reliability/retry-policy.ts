import type { FailureContext, RetryClassification, RetryResult, RetrySettings } from "./types";

export const DEFAULT_RETRY_SETTINGS: RetrySettings = {
  max_attempts: 3,
  delay: {
    base_delay_ms: 200,
    max_delay_ms: 2_000,
    jitter_ratio: 0.2
  }
};

export interface FailureLike {
  status_code?: number;
  code?: string;
  message?: string;
  stage?: string;
}

export function classifyFailure(error: FailureLike): RetryClassification {
  const status = error.status_code;
  const code = error.code?.toUpperCase();

  if (status === 429) {
    return { retryable: true, failure_class: "rate_limit" };
  }

  if (status === 403 && code === "RATE_LIMITED") {
    return { retryable: true, failure_class: "rate_limit" };
  }

  if (typeof status === "number" && status >= 500) {
    return { retryable: true, failure_class: "transient" };
  }

  if (code === "ECONNRESET" || code === "ETIMEDOUT" || code === "ENOTFOUND") {
    return { retryable: true, failure_class: "transient" };
  }

  if (code === "DEPENDENCY_BLOCKED") {
    return { retryable: false, failure_class: "dependency_blocked", terminal_reason: "dependency_blocked" };
  }

  if (code === "CANCELLED") {
    return { retryable: false, failure_class: "cancel_requested", terminal_reason: "cancel_requested" };
  }

  return { retryable: false, failure_class: "hard_failure", terminal_reason: "hard_failure" };
}

function computeDelayMs(settings: RetrySettings, attempt: number): number {
  const base = settings.delay.base_delay_ms * 2 ** (attempt - 1);
  const jitterBand = Math.floor(base * settings.delay.jitter_ratio);
  const jitter = jitterBand > 0 ? Math.floor(Math.random() * (jitterBand * 2 + 1)) - jitterBand : 0;
  return Math.max(0, Math.min(settings.delay.max_delay_ms, base + jitter));
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function toFailureContext(error: FailureLike, attempt: number, classification: RetryClassification): FailureContext {
  return {
    failure_class: classification.failure_class,
    message: error.message ?? "Unknown stage failure",
    stage: error.stage ?? "unknown-stage",
    attempt,
    status_code: error.status_code,
    diagnostics: {
      code: error.code
    }
  };
}

export async function executeWithRetry<T>(
  operation: (attempt: number) => Promise<T>,
  settings: RetrySettings = DEFAULT_RETRY_SETTINGS
): Promise<RetryResult<T>> {
  let lastFailure: FailureContext | undefined;

  for (let attempt = 1; attempt <= settings.max_attempts; attempt += 1) {
    try {
      const value = await operation(attempt);
      return {
        ok: true,
        attempts: attempt,
        value
      };
    } catch (rawError) {
      const error: FailureLike =
        typeof rawError === "object" && rawError !== null ? (rawError as FailureLike) : { message: String(rawError) };

      const classification = classifyFailure(error);
      lastFailure = toFailureContext(error, attempt, classification);

      if (!classification.retryable) {
        return {
          ok: false,
          terminal_reason: "transient_exhausted",
          attempts: attempt,
          last_failure: lastFailure
        };
      }

      const hasMoreAttempts = attempt < settings.max_attempts;
      if (!hasMoreAttempts) {
        return {
          ok: false,
          terminal_reason: "transient_exhausted",
          attempts: attempt,
          last_failure: lastFailure
        };
      }

      const delayMs = computeDelayMs(settings, attempt);
      await sleep(delayMs);
    }
  }

  return {
    ok: false,
    terminal_reason: "transient_exhausted",
    attempts: settings.max_attempts,
    last_failure:
      lastFailure ??
      {
        failure_class: "transient",
        message: "Retry loop ended unexpectedly",
        stage: "unknown-stage",
        attempt: settings.max_attempts
      }
  };
}
