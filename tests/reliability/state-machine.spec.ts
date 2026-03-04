import { describe, expect, it } from "vitest";

import {
  assertTransition,
  getAllowedTransitions,
  isTerminalState
} from "../../skills/github-researcher/lib/reliability/state-machine";

describe("state-machine", () => {
  it("accepts legal transitions", () => {
    expect(() => assertTransition("queued", "running")).not.toThrow();
    expect(() => assertTransition("running", "retrying")).not.toThrow();
    expect(() => assertTransition("retrying", "running")).not.toThrow();
    expect(() => assertTransition("running", "completed")).not.toThrow();
    expect(() => assertTransition("queued", "cancelled")).not.toThrow();
  });

  it("rejects illegal transitions with deterministic errors", () => {
    expect(() => assertTransition("queued", "completed")).toThrow("Illegal transition");
    expect(() => assertTransition("running", "queued")).toThrow("Allowed transitions");
    expect(() => assertTransition("paused", "failed")).toThrow("Illegal transition");
    expect(() => assertTransition("running", "running")).toThrow("self-transition");
  });

  it("treats completed/failed/cancelled as terminal and immutable", () => {
    expect(isTerminalState("completed")).toBe(true);
    expect(isTerminalState("failed")).toBe(true);
    expect(isTerminalState("cancelled")).toBe(true);
    expect(isTerminalState("running")).toBe(false);

    expect(() => assertTransition("completed", "running")).toThrow("is terminal");
    expect(() => assertTransition("failed", "retrying")).toThrow("is terminal");
    expect(() => assertTransition("cancelled", "queued")).toThrow("is terminal");
  });

  it("exposes transition table for orchestration callers", () => {
    expect(getAllowedTransitions("queued")).toEqual(["running", "cancelled"]);
    expect(getAllowedTransitions("failed")).toEqual([]);
  });
});
