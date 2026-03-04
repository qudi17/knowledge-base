import { describe, expect, it } from "vitest";

import { buildCoverageManifest } from "../../skills/github-researcher/lib/analysis/coverage/manifest-builder";
import { buildCoverageSummary, deriveCoverageQualityTier } from "../../skills/github-researcher/lib/analysis/coverage/summary";

describe("coverage summary", () => {
  it("derives quality tier from counters", () => {
    expect(
      deriveCoverageQualityTier({
        candidate_files: 100,
        scanned_files: 92,
        excluded_files: 4,
        unresolved_files: 2,
        deferred_files: 2
      })
    ).toBe("high");

    expect(
      deriveCoverageQualityTier({
        candidate_files: 100,
        scanned_files: 65,
        excluded_files: 20,
        unresolved_files: 10,
        deferred_files: 5
      })
    ).toBe("medium");
  });

  it("builds summary-first output with grouped gaps", () => {
    const manifest = buildCoverageManifest({
      phase_id: "06.1",
      files: [
        { path: "src/core/a.ts", parseable: true },
        { path: "src/core/b.ts", parseable: false },
        { path: "src/legacy/c.ts", deferred: true }
      ]
    });

    const summary = buildCoverageSummary(manifest);
    expect(summary.headline).toContain("Coverage");
    expect(summary.module_rows.length).toBeGreaterThan(0);
    expect(summary.known_gap_groups.length).toBe(2);
  });
});
