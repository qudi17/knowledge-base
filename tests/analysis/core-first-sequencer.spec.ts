import { describe, expect, it } from "vitest";

import {
  runCoreFirstSequence,
  shouldTransitionToBroadScan
} from "../../skills/github-researcher/lib/analysis/core/core-first-sequencer";

describe("core-first sequencer", () => {
  it("blocks broad scan until all core gates are satisfied", () => {
    const blocked = shouldTransitionToBroadScan({
      core_set_complete: true,
      role_explanations_complete: true,
      accepted_workflow_count: 0,
      snapshot_frozen: false,
      budget_used_ratio: 0.55
    });
    expect(blocked.allowed).toBe(false);
    expect(blocked.reason).toBe("workflow_minimum_unmet");
  });

  it("enforces 60-70 budget policy with explicit extension reason", () => {
    const noReason = shouldTransitionToBroadScan({
      core_set_complete: true,
      role_explanations_complete: true,
      accepted_workflow_count: 1,
      snapshot_frozen: true,
      budget_used_ratio: 0.65
    });
    expect(noReason.allowed).toBe(false);
    expect(noReason.reason).toBe("budget_extension_reason_missing");

    const withReason = shouldTransitionToBroadScan({
      core_set_complete: true,
      role_explanations_complete: true,
      accepted_workflow_count: 1,
      snapshot_frozen: true,
      budget_used_ratio: 0.65,
      budget_extension_reason: "complex cross-module initialization path"
    });
    expect(withReason.allowed).toBe(true);
  });

  it("tracks stage order and conflict revalidation requirement", () => {
    const state = runCoreFirstSequence({
      completed_stages: [
        "entry_modules",
        "core_business",
        "supporting_modules",
        "workflow_reconstruction",
        "snapshot_freeze"
      ],
      gates: {
        core_set_complete: true,
        role_explanations_complete: true,
        accepted_workflow_count: 2,
        snapshot_frozen: true,
        budget_used_ratio: 0.6,
        budget_extension_reason: "allowed boundary"
      },
      conflict_detected: true
    });

    expect(state.next_stage).toBe("broad_scan");
    expect(state.transition_allowed).toBe(true);
    expect(state.revalidation_required).toBe(true);
  });
});
