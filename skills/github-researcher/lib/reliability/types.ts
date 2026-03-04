export type RunState =
  | "queued"
  | "running"
  | "retrying"
  | "paused"
  | "failed"
  | "completed"
  | "cancelled";

export type TerminalState = Extract<RunState, "failed" | "completed" | "cancelled">;

export type TerminalReason =
  | "completed"
  | "hard_failure"
  | "dependency_blocked"
  | "cancel_requested"
  | "transient_exhausted";

export type FailureClass =
  | "transient"
  | "rate_limit"
  | "hard_failure"
  | "dependency_blocked"
  | "cancel_requested";

export interface FailureContext {
  failure_class: FailureClass;
  message: string;
  stage: string;
  attempt: number;
  status_code?: number;
  diagnostics?: Record<string, unknown>;
}

export interface RetryClassification {
  retryable: boolean;
  failure_class: FailureClass;
  terminal_reason?: TerminalReason;
}

export interface RetryDelayPolicy {
  base_delay_ms: number;
  max_delay_ms: number;
  jitter_ratio: number;
}

export interface RetrySettings {
  max_attempts: number;
  delay: RetryDelayPolicy;
}

export interface RetryExhausted {
  ok: false;
  terminal_reason: "transient_exhausted";
  attempts: number;
  last_failure: FailureContext;
}

export interface RetrySuccess<T> {
  ok: true;
  attempts: number;
  value: T;
}

export type RetryResult<T> = RetrySuccess<T> | RetryExhausted;

export interface RunSnapshot {
  state: RunState;
  terminal_reason?: TerminalReason;
  failure_context?: FailureContext;
}
