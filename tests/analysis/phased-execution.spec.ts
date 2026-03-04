import { describe, expect, it } from "vitest";

import { buildPhaseScopePlan } from "../../skills/github-researcher/lib/analysis/coverage/phase-planner";
import {
  resumeCoveragePhasesFromCheckpoint,
  runCoveragePhases
} from "../../skills/github-researcher/lib/analysis/coverage/phased-execution";

describe("phased execution", () => {
  it("runs phases and continues on safe failure", async () => {
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
      }
    });

    expect(result.records.length).toBe(2);
    expect(result.records[0].status).toBe("failed");
    expect(result.records[1].status).toBe("completed");
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
});
