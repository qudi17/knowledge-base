import { describe, expect, it } from "vitest";

import {
  buildPhaseScopePlan,
  shouldUsePhasedCoverageExecution
} from "../../skills/github-researcher/lib/analysis/coverage/phase-planner";

describe("phase planner", () => {
  it("enables phased execution for large repositories", () => {
    expect(
      shouldUsePhasedCoverageExecution({
        candidate_files: 1400,
        module_count: 20
      })
    ).toBe(true);

    expect(
      shouldUsePhasedCoverageExecution({
        candidate_files: 400,
        module_count: 10
      })
    ).toBe(false);
  });

  it("builds deterministic chunks with core-first ordering", () => {
    const planA = buildPhaseScopePlan({
      phase_prefix: "06",
      modules: [
        { module_id: "z/support", file_count: 250, core_rank: 8 },
        { module_id: "a/entry", file_count: 300, core_rank: 1 },
        { module_id: "m/core", file_count: 260, core_rank: 3 }
      ],
      max_files_per_phase: 500
    });

    const planB = buildPhaseScopePlan({
      phase_prefix: "06",
      modules: [
        { module_id: "m/core", file_count: 260, core_rank: 3 },
        { module_id: "z/support", file_count: 250, core_rank: 8 },
        { module_id: "a/entry", file_count: 300, core_rank: 1 }
      ],
      max_files_per_phase: 500
    });

    expect(planA.chunks).toEqual(planB.chunks);
    expect(planA.chunks[0].module_ids[0]).toBe("a/entry");
  });
});
