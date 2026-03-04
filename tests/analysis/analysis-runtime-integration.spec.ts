import { describe, expect, it } from "vitest";

import { runAnalysisWithCoverage } from "../../skills/github-researcher/lib/analysis";

describe("analysis runtime integration", () => {
  it("produces explicit coverage summary and phased merge output for large repositories", async () => {
    const result = await runAnalysisWithCoverage({
      run_id: "06-runtime",
      modules: [
        { module_id: "a/entry", file_count: 900, core_rank: 1 },
        { module_id: "b/core", file_count: 900, core_rank: 2 }
      ],
      files: [
        { path: "src/a.ts", parseable: true },
        { path: "src/b.ts", parseable: false },
        { path: "dist/bundle.js", parseable: true }
      ],
      large_repo_hint: {
        candidate_files: 2000,
        module_count: 120
      },
      run_phase: async (phaseId, scope) => ({
        conclusions: [
          {
            conclusion_id: `${phaseId}-c1`,
            key: "entry",
            statement: `entry via ${scope[0]}`,
            confidence: "medium",
            evidence_ids: [`${phaseId}-e1`]
          }
        ],
        gaps: []
      })
    });

    expect(result.phased).toBe(true);
    expect(result.coverage_summary.headline.toLowerCase()).toContain("coverage");
    expect(result.merged_output.global_coverage_statement).toContain("Merged");
    expect(result.phase_appendix.length).toBeGreaterThan(0);
  });

  it("covers safe-continue denied and allowed paths with lineage in merged output", async () => {
    const denied = await runAnalysisWithCoverage({
      run_id: "06-denied",
      modules: [
        { module_id: "a/entry", file_count: 900, core_rank: 1 },
        { module_id: "b/core", file_count: 900, core_rank: 2 }
      ],
      files: [{ path: "src/a.ts", parseable: true }],
      large_repo_hint: { candidate_files: 2000, module_count: 120 },
      run_phase: async (phaseId) => {
        if (phaseId.endsWith(".1")) {
          throw new Error("high risk failure");
        }
        return { conclusions: [], gaps: [] };
      }
    });

    expect(denied.merged_output.per_phase_coverage_statements.some((line) => line.includes("failed"))).toBe(true);

    const allowed = await runAnalysisWithCoverage({
      run_id: "06-allowed",
      modules: [
        { module_id: "a/entry", file_count: 900, core_rank: 1 },
        { module_id: "b/core", file_count: 900, core_rank: 2 }
      ],
      files: [{ path: "src/a.ts", parseable: true }],
      large_repo_hint: { candidate_files: 2000, module_count: 120 },
      run_phase: async (phaseId) => ({
        conclusions: [
          {
            conclusion_id: `${phaseId}-c`,
            key: "flow",
            statement: "flow ok",
            confidence: "high",
            evidence_ids: [`${phaseId}-e`]
          }
        ],
        gaps: []
      })
    });

    expect(allowed.merged_output.merged_conclusions[0].conflict_sources.length).toBeGreaterThan(0);
  });
});
