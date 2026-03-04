import { describe, expect, it } from "vitest";

import {
  adjudicateConflictingConclusions,
  mergeCoveragePhaseOutputs
} from "../../skills/github-researcher/lib/analysis/coverage/merge-coherence";

describe("merge coherence", () => {
  it("adjudicates conflicts while preserving history", () => {
    const merged = adjudicateConflictingConclusions({
      key: "core_entry",
      records: [
        { statement: "Entry starts at api.ts", confidence: "medium", evidence_ids: ["E-1"] },
        { statement: "Entry starts at bootstrap.ts", confidence: "high", evidence_ids: ["E-2", "E-3"] }
      ]
    });

    expect(merged.statement).toBe("Entry starts at bootstrap.ts");
    expect(merged.conflict_history).toEqual(["Entry starts at api.ts"]);
    expect(merged.evidence_ids).toEqual(["E-1", "E-2", "E-3"]);
  });

  it("deduplicates findings and emits coherent merged output", () => {
    const output = mergeCoveragePhaseOutputs({
      phase_records: [
        {
          phase_id: "06.1",
          scope: ["a/entry"],
          status: "completed",
          conclusions: [
            {
              key: "core_entry",
              statement: "Entry starts at bootstrap.ts",
              confidence: "high",
              evidence_ids: ["E-2"]
            }
          ],
          gaps: [],
          started_at: "2026-03-04T00:00:00.000Z",
          ended_at: "2026-03-04T00:01:00.000Z"
        },
        {
          phase_id: "06.2",
          scope: ["b/core"],
          status: "completed",
          conclusions: [
            {
              key: "core_entry",
              statement: "Entry starts at bootstrap.ts",
              confidence: "medium",
              evidence_ids: ["E-4"]
            }
          ],
          gaps: [
            {
              phase_id: "06.2",
              module_id: "b/core",
              path: "b/core/legacy.ts",
              cause: "deferred_scope",
              impact: "low",
              reason: "deferred"
            }
          ],
          started_at: "2026-03-04T00:01:00.000Z",
          ended_at: "2026-03-04T00:02:00.000Z"
        }
      ]
    });

    expect(output.merged_conclusions.length).toBe(1);
    expect(output.merged_conclusions[0].evidence_ids).toEqual(["E-2", "E-4"]);
    expect(output.per_phase_coverage_statements.length).toBe(2);
    expect(output.merged_gaps.length).toBe(1);
  });
});
