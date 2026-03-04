import type { FailureContext, TerminalReason } from "./types";

export type ProgressEventKind = "transition" | "cadence" | "terminal";

export interface ProgressEvent {
  run_id: string;
  stage: string;
  state: string;
  kind: ProgressEventKind;
  timestamp: string;
  attempt?: number;
  terminal_reason?: TerminalReason;
  message?: string;
  failure_class?: FailureContext["failure_class"];
}

export interface ProgressReporterState {
  last_emit_at_ms: number;
}

export interface EmitProgressInput {
  run_id: string;
  stage: string;
  state: string;
  kind: Exclude<ProgressEventKind, "cadence"> | "cadence";
  now_ms: number;
  now_iso?: string;
  cadence_min_ms?: number;
  cadence_max_ms?: number;
  last_emit_at_ms?: number;
  attempt?: number;
  message?: string;
  terminal_reason?: TerminalReason;
  failure_context?: FailureContext;
}

export interface EmitProgressResult {
  emitted: boolean;
  event?: ProgressEvent;
  state: ProgressReporterState;
}

export interface FinalSummaryInput {
  run_id: string;
  conclusion: string;
  terminal_reason: TerminalReason;
  transition_trace: string[];
  retry_statistics: {
    total_attempts: number;
    retried_stages: number;
    exhausted_stages: number;
  };
  failures?: FailureContext[];
}

export interface FinalSummary {
  conclusion: string;
  terminal_reason: TerminalReason;
  transition_trace: string[];
  retry_statistics: {
    total_attempts: number;
    retried_stages: number;
    exhausted_stages: number;
  };
  pinned_failures: FailureContext[];
  failure_details: FailureContext[];
}

const DEFAULT_CADENCE_MIN_MS = 10_000;
const DEFAULT_CADENCE_MAX_MS = 30_000;

function toIso(nowMs: number, explicit?: string): string {
  return explicit ?? new Date(nowMs).toISOString();
}

function shouldEmitCadence(nowMs: number, lastEmitMs: number, minMs: number, maxMs: number): boolean {
  const elapsed = nowMs - lastEmitMs;
  if (elapsed < minMs) {
    return false;
  }

  return elapsed >= minMs && elapsed <= maxMs + minMs;
}

export function emitProgress(input: EmitProgressInput): EmitProgressResult {
  const minMs = input.cadence_min_ms ?? DEFAULT_CADENCE_MIN_MS;
  const maxMs = input.cadence_max_ms ?? DEFAULT_CADENCE_MAX_MS;
  const lastEmitMs = input.last_emit_at_ms ?? 0;

  if (input.kind === "cadence" && !shouldEmitCadence(input.now_ms, lastEmitMs, minMs, maxMs)) {
    return {
      emitted: false,
      state: {
        last_emit_at_ms: lastEmitMs
      }
    };
  }

  const event: ProgressEvent = {
    run_id: input.run_id,
    stage: input.stage,
    state: input.state,
    kind: input.kind,
    timestamp: toIso(input.now_ms, input.now_iso),
    attempt: input.attempt,
    terminal_reason: input.terminal_reason,
    message: input.message,
    failure_class: input.failure_context?.failure_class
  };

  return {
    emitted: true,
    event,
    state: {
      last_emit_at_ms: input.now_ms
    }
  };
}

function priority(failure: FailureContext): number {
  if (failure.failure_class === "hard_failure") return 0;
  if (failure.failure_class === "dependency_blocked") return 1;
  if (failure.failure_class === "rate_limit") return 2;
  if (failure.failure_class === "transient") return 3;
  return 4;
}

export function buildFinalSummary(input: FinalSummaryInput): FinalSummary {
  const failures = [...(input.failures ?? [])];
  const ordered = failures.sort((a, b) => {
    const prioDiff = priority(a) - priority(b);
    if (prioDiff !== 0) {
      return prioDiff;
    }

    if (a.attempt !== b.attempt) {
      return b.attempt - a.attempt;
    }

    return a.stage.localeCompare(b.stage);
  });

  const pinned = ordered.slice(0, Math.min(3, ordered.length));

  return {
    conclusion: input.conclusion,
    terminal_reason: input.terminal_reason,
    transition_trace: [...input.transition_trace],
    retry_statistics: { ...input.retry_statistics },
    pinned_failures: pinned,
    failure_details: ordered
  };
}
