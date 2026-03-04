import { describe, expect, it } from "vitest";

import {
  buildFinalSummary,
  emitProgress
} from "../../skills/github-researcher/lib/reliability/progress-reporter";

describe("progress-reporter emitProgress", () => {
  it("always emits transition and terminal events", () => {
    const transition = emitProgress({
      run_id: "run-emit-1",
      stage: "intake",
      state: "running",
      kind: "transition",
      now_ms: 10_000,
      last_emit_at_ms: 0
    });

    const terminal = emitProgress({
      run_id: "run-emit-1",
      stage: "intake",
      state: "failed",
      kind: "terminal",
      now_ms: 10_500,
      last_emit_at_ms: transition.state.last_emit_at_ms,
      message: "terminal"
    });

    expect(transition.emitted).toBe(true);
    expect(transition.event?.kind).toBe("transition");
    expect(terminal.emitted).toBe(true);
    expect(terminal.event?.kind).toBe("terminal");
  });

  it("emits cadence only inside 10-30s windows", () => {
    const tooSoon = emitProgress({
      run_id: "run-emit-2",
      stage: "analyze",
      state: "running",
      kind: "cadence",
      now_ms: 1_000,
      last_emit_at_ms: 0,
      cadence_min_ms: 10_000,
      cadence_max_ms: 30_000
    });

    const inWindow = emitProgress({
      run_id: "run-emit-2",
      stage: "analyze",
      state: "running",
      kind: "cadence",
      now_ms: 15_000,
      last_emit_at_ms: 0,
      cadence_min_ms: 10_000,
      cadence_max_ms: 30_000
    });

    expect(tooSoon.emitted).toBe(false);
    expect(inWindow.emitted).toBe(true);
    expect(inWindow.event?.kind).toBe("cadence");
  });
});

describe("progress-reporter buildFinalSummary", () => {
  it("pins high-priority failures at top and keeps conclusion first", () => {
    const summary = buildFinalSummary({
      run_id: "run-summary-1",
      conclusion: "Run failed at report stage.",
      terminal_reason: "hard_failure",
      transition_trace: ["queued", "running", "failed"],
      retry_statistics: {
        total_attempts: 5,
        retried_stages: 2,
        exhausted_stages: 1
      },
      failures: [
        {
          failure_class: "transient",
          message: "temp",
          stage: "fetch",
          attempt: 3
        },
        {
          failure_class: "hard_failure",
          message: "bad input",
          stage: "parse",
          attempt: 1
        },
        {
          failure_class: "rate_limit",
          message: "429",
          stage: "collect",
          attempt: 4
        }
      ]
    });

    expect(summary.conclusion).toBe("Run failed at report stage.");
    expect(summary.pinned_failures.length).toBe(3);
    expect(summary.pinned_failures[0].failure_class).toBe("hard_failure");
    expect(summary.pinned_failures[1].failure_class).toBe("rate_limit");
    expect(summary.pinned_failures[2].failure_class).toBe("transient");
    expect(summary.retry_statistics.total_attempts).toBe(5);
  });
});
