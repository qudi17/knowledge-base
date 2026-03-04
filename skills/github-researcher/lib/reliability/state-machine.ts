import { RunState, TerminalState } from "./types";

const TERMINAL_STATES: ReadonlySet<RunState> = new Set(["completed", "failed", "cancelled"]);

const ALLOWED_TRANSITIONS: Readonly<Record<RunState, readonly RunState[]>> = {
  queued: ["running", "cancelled"],
  running: ["retrying", "paused", "failed", "completed", "cancelled"],
  retrying: ["running", "failed", "cancelled"],
  paused: ["running", "cancelled"],
  failed: [],
  completed: [],
  cancelled: []
};

const toLabel = (state: RunState): string => `'${state}'`;

const listAllowed = (state: RunState): string => {
  const allowed = ALLOWED_TRANSITIONS[state];
  return allowed.length > 0 ? allowed.map(toLabel).join(", ") : "<none>";
};

export const isTerminalState = (state: RunState): state is TerminalState => {
  return TERMINAL_STATES.has(state);
};

export const assertTransition = (from: RunState, to: RunState): void => {
  if (isTerminalState(from)) {
    throw new Error(
      `Illegal transition: state ${toLabel(from)} is terminal and cannot transition to ${toLabel(to)}.`
    );
  }

  if (from === to) {
    throw new Error(`Illegal transition: self-transition ${toLabel(from)} -> ${toLabel(to)} is not allowed.`);
  }

  const allowed = ALLOWED_TRANSITIONS[from];
  if (!allowed.includes(to)) {
    throw new Error(
      `Illegal transition: ${toLabel(from)} -> ${toLabel(to)}. Allowed transitions from ${toLabel(from)}: ${listAllowed(from)}.`
    );
  }
};

export const getAllowedTransitions = (from: RunState): readonly RunState[] => {
  return [...ALLOWED_TRANSITIONS[from]];
};
