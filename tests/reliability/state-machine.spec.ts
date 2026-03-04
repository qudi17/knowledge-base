import { describe, expect, it } from "vitest";

import {
  assertTransition,
  getAllowedTransitions,
  isTerminalState
} from "../../skills/github-researcher/lib/reliability/state-machine";
import { createRunController } from "../../skills/github-researcher/lib/reliability/run-controller";

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

describe("run-controller completion behavior", () => {
  it("continues toward completion on successful stage execution", async () => {
    const controller = createRunController("run-1");

    const stageResult = await controller.executeStage({
      name: "stage-a",
      run: async () => "ok"
    });

    expect(stageResult.ok).toBe(true);
    controller.complete();

    const snapshot = controller.snapshot();
    expect(snapshot.state).toBe("completed");
    expect(snapshot.terminal_reason).toBe("completed");
  });

  it("routes retry exhaustion to failed terminal state", async () => {
    const controller = createRunController("run-2");

    const stageResult = await controller.executeStage({
      name: "stage-b",
      run: async () => {
        throw { status_code: 503, message: "down", stage: "stage-b" };
      }
    });

    expect(stageResult.ok).toBe(false);
    const snapshot = controller.snapshot();
    expect(snapshot.state).toBe("failed");
    expect(snapshot.terminal_reason).toBe("transient_exhausted");
    expect(snapshot.failure_context?.stage).toBe("stage-b");
  });
});
