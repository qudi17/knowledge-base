import { describe, expect, it } from "vitest";

import { classifyFailure, DEFAULT_RETRY_SETTINGS, executeWithRetry } from "../../skills/github-researcher/lib/reliability/retry-policy";

describe("retry-policy classifyFailure", () => {
  it("marks 429 and rate-limit 403 as retryable", () => {
    expect(classifyFailure({ status_code: 429 }).retryable).toBe(true);
    expect(classifyFailure({ status_code: 403, code: "RATE_LIMITED" }).retryable).toBe(true);
  });

  it("marks transient transport failures as retryable", () => {
    expect(classifyFailure({ code: "ECONNRESET" }).retryable).toBe(true);
    expect(classifyFailure({ status_code: 503 }).retryable).toBe(true);
  });

  it("marks hard failures as non-retryable", () => {
    const cls = classifyFailure({ status_code: 400, code: "BAD_INPUT" });
    expect(cls.retryable).toBe(false);
    expect(cls.failure_class).toBe("hard_failure");
  });
});

describe("executeWithRetry", () => {
  it("succeeds before maxAttempts", async () => {
    let calls = 0;
    const result = await executeWithRetry(async () => {
      calls += 1;
      if (calls < 3) {
        throw { status_code: 503, message: "temp fail", stage: "fetch" };
      }
      return "ok";
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toBe("ok");
      expect(result.attempts).toBe(3);
    }
  });

  it("enforces maxAttempts ceiling and transient_exhausted", async () => {
    let calls = 0;
    const result = await executeWithRetry(
      async () => {
        calls += 1;
        throw { status_code: 503, message: "always fail", stage: "fetch" };
      },
      {
        ...DEFAULT_RETRY_SETTINGS,
        max_attempts: 3,
        delay: { ...DEFAULT_RETRY_SETTINGS.delay, base_delay_ms: 1, max_delay_ms: 2 }
      }
    );

    expect(result.ok).toBe(false);
    expect(calls).toBe(3);
    if (!result.ok) {
      expect(result.terminal_reason).toBe("transient_exhausted");
      expect(result.last_failure.failure_class).toBe("transient");
    }
  });

  it("does not consume retry budget for non-retryable failure", async () => {
    let calls = 0;
    const result = await executeWithRetry(async () => {
      calls += 1;
      throw { status_code: 400, code: "BAD_INPUT", message: "no retry", stage: "parse" };
    });

    expect(result.ok).toBe(false);
    expect(calls).toBe(1);
    if (!result.ok) {
      expect(result.last_failure.failure_class).toBe("hard_failure");
    }
  });
});
