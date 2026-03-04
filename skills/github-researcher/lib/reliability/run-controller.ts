import { executeWithRetry } from "./retry-policy";
import { assertTransition, isTerminalState } from "./state-machine";
import type { FailureContext, RunSnapshot, RunState, TerminalReason } from "./types";

export interface StageExecutor<T = unknown> {
  name: string;
  run: (attempt: number) => Promise<T>;
}

export interface ControllerState {
  run_id: string;
  state: RunState;
  terminal_reason?: TerminalReason;
  failure_context?: FailureContext;
  transition_trace: RunState[];
}

export interface RunController {
  snapshot: () => ControllerState;
  transition: (next: RunState) => void;
  executeStage: <T>(stage: StageExecutor<T>) => Promise<{ ok: true; value: T } | { ok: false }>;
  complete: () => void;
  cancel: () => void;
  fail: (reason: TerminalReason, failure?: FailureContext) => void;
  failFromClass: (failure: FailureContext) => void;
}

function nextState(current: RunState, wanted: RunState): RunState {
  assertTransition(current, wanted);
  return wanted;
}

function terminalReasonFromFailureClass(failure: FailureContext): TerminalReason {
  if (failure.failure_class === "dependency_blocked") {
    return "dependency_blocked";
  }

  if (failure.failure_class === "cancel_requested") {
    return "cancel_requested";
  }

  if (failure.failure_class === "hard_failure") {
    return "hard_failure";
  }

  return "transient_exhausted";
}

export function createRunController(runId: string): RunController {
  const internal: ControllerState = {
    run_id: runId,
    state: "queued",
    transition_trace: ["queued"]
  };

  const transition = (next: RunState): void => {
    if (isTerminalState(internal.state)) {
      throw new Error(`Cannot transition from terminal state '${internal.state}'.`);
    }

    internal.state = nextState(internal.state, next);
    internal.transition_trace.push(internal.state);
  };

  const fail = (reason: TerminalReason, failure?: FailureContext): void => {
    if (!isTerminalState(internal.state)) {
      assertTransition(internal.state, "failed");
      internal.state = "failed";
      internal.transition_trace.push("failed");
    }
    internal.terminal_reason = reason;
    internal.failure_context = failure;
  };

  const failFromClass = (failure: FailureContext): void => {
    fail(terminalReasonFromFailureClass(failure), failure);
  };

  const complete = (): void => {
    if (!isTerminalState(internal.state)) {
      assertTransition(internal.state, "completed");
      internal.state = "completed";
      internal.transition_trace.push("completed");
    }
    internal.terminal_reason = "completed";
  };

  const cancel = (): void => {
    if (!isTerminalState(internal.state)) {
      assertTransition(internal.state, "cancelled");
      internal.state = "cancelled";
      internal.transition_trace.push("cancelled");
    }
    internal.terminal_reason = "cancel_requested";
  };

  const executeStage = async <T>(stage: StageExecutor<T>): Promise<{ ok: true; value: T } | { ok: false }> => {
    if (internal.state === "queued") {
      transition("running");
    }

    if (internal.state === "paused") {
      transition("running");
    }

    const retryResult = await executeWithRetry<T>(stage.run);

    if (retryResult.ok) {
      return { ok: true, value: retryResult.value };
    }

    fail("transient_exhausted", {
      ...retryResult.last_failure,
      stage: stage.name
    });

    return { ok: false };
  };

  const snapshot = (): ControllerState => ({
    ...internal,
    transition_trace: [...internal.transition_trace]
  });

  return {
    snapshot,
    transition,
    executeStage,
    complete,
    cancel,
    fail,
    failFromClass
  };
}

export function toRunSnapshot(state: ControllerState): RunSnapshot {
  return {
    state: state.state,
    terminal_reason: state.terminal_reason,
    failure_context: state.failure_context
  };
}
