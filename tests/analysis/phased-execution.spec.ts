import { describe, expect, it } from "vitest";

import { buildPhaseScopePlan } from "../../skills/github-researcher/lib/analysis/coverage/phase-planner";
import {
  evaluateSafeContinueCriteria,
  resumeCoveragePhasesFromCheckpoint,
  runCoveragePhases
} from "../../skills/github-researcher/lib/analysis/coverage/phased-execution";

describe("phased execution", () => {
  it("runs phases and continues only when safe-continue policy allows", async () => {
    const plan = buildPhaseScopePlan({
      phase_prefix: "06",
      modules: [
        { module_id: "a/entry", file_count: 900, core_rank: 1 },
        { module_id: "b/core", file_count: 850, core_rank: 2 }
      ],
      max_files_per_phase: 900,
      force_phased: true
    });

    const result = await runCoveragePhases({
      plan,
      continue_on_safe_failure: true,
      run_phase: async (phaseId) => {
        if (phaseId.endsWith(".1")) {
          throw new Error("temporary executor crash");
        }
        return {
          conclusions: [],
          gaps: []
        };
      },
      safe_continue_evaluator: () => ({
        phase_id: "06.1",
        allowed: true,
        reason_code: "allow_low_impact_failure",
        rationale: "test allow"
      })
    });

    expect(result.records.length).toBe(2);
    expect(result.records[0].status).toBe("failed");
    expect(result.records[1].status).toBe("completed");
    expect(result.safe_continue_decisions[0].reason_code).toBe("allow_low_impact_failure");
  });

  it("terminates deterministically when safe-continue denied", async () => {
    const plan = buildPhaseScopePlan({
      phase_prefix: "06",
      modules: [
        { module_id: "a/entry", file_count: 850, core_rank: 1 },
        { module_id: "b/core", file_count: 850, core_rank: 2 }
      ],
      max_files_per_phase: 900,
      force_phased: true
    });

    const denied = await runCoveragePhases({
      plan,
      continue_on_safe_failure: true,
      run_phase: async () => {
        throw new Error("critical failure");
      },
      safe_continue_evaluator: () => ({
        phase_id: "06.1",
        allowed: false,
        reason_code: "deny_high_impact_failure",
        rationale: "test deny"
      })
    });

    expect(denied.records.length).toBe(1);
    expect(denied.terminal_reason).toBe("deny_high_impact_failure");
    expect(denied.remaining_scope_queue.length).toBeGreaterThan(0);
  });

  it("resumes from remaining queue without replaying completed phases", async () => {
    const plan = buildPhaseScopePlan({
      phase_prefix: "06",
      modules: [
        { module_id: "a/entry", file_count: 850, core_rank: 1 },
        { module_id: "b/core", file_count: 850, core_rank: 2 }
      ],
      max_files_per_phase: 900,
      force_phased: true
    });

    const calls: string[] = [];

    const resumed = await resumeCoveragePhasesFromCheckpoint({
      plan,
      checkpoint: {
        completed_phase_ids: ["06.1"],
        remaining_scope_queue: ["06.2"]
      },
      run_phase: async (phaseId) => {
        calls.push(phaseId);
        return { conclusions: [], gaps: [] };
      }
    });

    expect(calls).toEqual(["06.2"]);
    expect(resumed.completed_phase_ids).toEqual(["06.1", "06.2"]);
  });

  it("evaluates default safe-continue criteria with reason codes", () => {
    const denied = evaluateSafeContinueCriteria({
      phase_id: "06.3",
      failure_gap: {
        phase_id: "06.3",
        module_id: "core",
        path: "src/core.ts",
        cause: "execution_failure",
        impact: "high",
        reason: "fatal"
      },
      remaining_scope_count: 2,
      completed_phase_count: 0
    });

    expect(denied.allowed).toBe(false);
    expect(denied.reason_code).toBe("deny_high_impact_failure");
  });
});
