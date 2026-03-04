import { describe, expect, it } from "vitest";

import {
  buildCoreSnapshotArtifact,
  freezeCoreConclusionSnapshot,
  parseCoreSnapshotArtifact,
  updateCoreSnapshotAfterRevalidation
} from "../../skills/github-researcher/lib/analysis/core/artifacts";
import { DEFAULT_SELECTION_CONFIG } from "../../skills/github-researcher/lib/analysis/core/core-scoring";

describe("core contracts and artifacts", () => {
  it("builds and parses stable core snapshot artifact", () => {
    const artifact = buildCoreSnapshotArtifact({
      selection_config: DEFAULT_SELECTION_CONFIG,
      selected_modules: [
        {
          module_id: "src/core/engine",
          module_path: "src/core/engine",
          responsibility: "execution engine",
          entry_points: ["run"],
          stability: "stable",
          evidence: {
            critical_path: 0.9,
            change_activity: 0.6,
            dependency_centrality: 0.8,
            evidence_classes: ["critical_path", "dependency_centrality"]
          },
          core_score: 0.81,
          evidence_class_count: 2,
          rationale: "scored",
          manually_promoted: false
        }
      ],
      role_explanations: [
        {
          module_id: "src/core/engine",
          summary: "stable engine",
          entry_points: ["run"],
          stability: "stable",
          evidence_class_count: 2,
          rationale: "scored"
        }
      ]
    });

    const parsed = parseCoreSnapshotArtifact(JSON.stringify(artifact));
    expect(parsed.phase).toBe("05");
    expect(parsed.modules[0].role_summary).toBe("stable engine");
  });

  it("freezes and revalidates snapshot metadata", () => {
    const base = buildCoreSnapshotArtifact({
      selection_config: DEFAULT_SELECTION_CONFIG,
      selected_modules: [],
      role_explanations: []
    });

    const frozen = freezeCoreConclusionSnapshot(base, "2026-03-04T00:00:00.000Z");
    expect(frozen.frozen).toBe(true);

    const updated = updateCoreSnapshotAfterRevalidation(
      frozen,
      "conflict detected",
      "2026-03-04T01:00:00.000Z"
    );
    expect(updated.snapshot_version).toBe(frozen.snapshot_version + 1);
    expect(updated.revalidation?.reason).toBe("conflict detected");
  });
});
