import { describe, expect, it } from "vitest";

import {
  adjudicateConflictingConclusions,
  mergeCoveragePhaseOutputs
} from "../../skills/github-researcher/lib/analysis/coverage/merge-coherence";

describe("merge coherence", () => {
  it("adjudicates conflicts while preserving history and source lineage", () => {
    const merged = adjudicateConflictingConclusions({
      key: "core_entry",
      records: [
        {
          statement: "Entry starts at api.ts",
          confidence: "medium",
          evidence_ids: ["E-1"],
          source: {
            phase_id: "06.1",
            phase_record_id: "06.1::a",
            conclusion_id: "C-1",
            evidence_ids: ["E-1"]
          }
        },
        {
          statement: "Entry starts at bootstrap.ts",
          confidence: "high",
          evidence_ids: ["E-2", "E-3"],
          source: {
            phase_id: "06.2",
            phase_record_id: "06.2::b",
            conclusion_id: "C-2",
            evidence_ids: ["E-2", "E-3"]
          }
        }
      ]
    });

    expect(merged.statement).toBe("Entry starts at bootstrap.ts");
    expect(merged.conflict_history).toEqual(["Entry starts at api.ts"]);
    expect(merged.evidence_ids).toEqual(["E-1", "E-2", "E-3"]);
    expect(merged.conflict_sources.length).toBe(2);
    expect(merged.conflict_sources[0].phase_record_id).toBe("06.2::b");
  });

  it("deduplicates findings and emits coherent merged output", () => {
    const output = mergeCoveragePhaseOutputs({
      phase_records: [
        {
          phase_record_id: "06.1::x",
          phase_id: "06.1",
          scope: ["a/entry"],
          status: "completed",
          conclusions: [
            {
              conclusion_id: "C-10",
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
          phase_record_id: "06.2::y",
          phase_id: "06.2",
          scope: ["b/core"],
          status: "completed",
          conclusions: [
            {
              conclusion_id: "C-11",
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
    expect(output.merged_conclusions[0].conflict_sources.length).toBe(2);
    expect(output.per_phase_coverage_statements.length).toBe(2);
    expect(output.merged_gaps.length).toBe(1);
  });
});
