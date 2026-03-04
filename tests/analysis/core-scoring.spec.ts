import { describe, expect, it } from "vitest";

import {
  DEFAULT_SELECTION_CONFIG,
  scoreCoreModules,
  selectCoreModules,
  top5OverlapRatio
} from "../../skills/github-researcher/lib/analysis/core/core-scoring";
import type { CoreModuleCandidate } from "../../skills/github-researcher/lib/analysis/core/types";

function candidate(seed: Partial<CoreModuleCandidate> & Pick<CoreModuleCandidate, "module_id" | "module_path">): CoreModuleCandidate {
  return {
    module_id: seed.module_id,
    module_path: seed.module_path,
    responsibility: seed.responsibility ?? "module",
    entry_points: seed.entry_points ?? ["run"],
    stability: seed.stability ?? "evolving",
    manual_promotion_reason: seed.manual_promotion_reason,
    evidence: {
      critical_path: seed.evidence?.critical_path ?? 0,
      change_activity: seed.evidence?.change_activity ?? 0,
      dependency_centrality: seed.evidence?.dependency_centrality ?? 0,
      evidence_classes: seed.evidence?.evidence_classes ?? ["critical_path", "change_activity"]
    }
  };
}

describe("core scoring", () => {
  it("scores with fixed weights and deterministic tie-break", () => {
    const scored = scoreCoreModules([
      candidate({
        module_id: "src/c",
        module_path: "src/c",
        evidence: { critical_path: 0.8, change_activity: 0.4, dependency_centrality: 0.4, evidence_classes: ["critical_path", "change_activity"] }
      }),
      candidate({
        module_id: "src/a",
        module_path: "src/a",
        evidence: { critical_path: 0.8, change_activity: 0.4, dependency_centrality: 0.4, evidence_classes: ["critical_path", "change_activity"] }
      }),
      candidate({
        module_id: "src/b",
        module_path: "src/b",
        evidence: { critical_path: 0.9, change_activity: 0.5, dependency_centrality: 0.2, evidence_classes: ["critical_path", "dependency_centrality"] }
      })
    ]);

    expect(DEFAULT_SELECTION_CONFIG.weights).toEqual({
      critical_path: 0.5,
      change_activity: 0.3,
      dependency_centrality: 0.2
    });
    expect(scored[0].module_id).toBe("src/b");
    expect(scored[1].module_id).toBe("src/a");
    expect(scored[2].module_id).toBe("src/c");
    expect(scored[0].core_score).toBeCloseTo(0.64, 4);
  });

  it("applies evidence-class minimum plus threshold/manual promotion selection", () => {
    const scored = scoreCoreModules([
      candidate({
        module_id: "src/high",
        module_path: "src/high",
        evidence: { critical_path: 0.9, change_activity: 0.8, dependency_centrality: 0.7, evidence_classes: ["critical_path", "change_activity", "dependency_centrality"] }
      }),
      candidate({
        module_id: "src/manual",
        module_path: "src/manual",
        manual_promotion_reason: "owner flagged as business critical",
        evidence: { critical_path: 0.2, change_activity: 0.1, dependency_centrality: 0.2, evidence_classes: ["critical_path", "manual_promotion"] }
      }),
      candidate({
        module_id: "src/weak",
        module_path: "src/weak",
        evidence: { critical_path: 0.9, change_activity: 0.9, dependency_centrality: 0.9, evidence_classes: ["critical_path"] }
      })
    ]);

    const selected = selectCoreModules(scored);
    expect(selected.map((item) => item.module_id)).toEqual(["src/high", "src/manual"]);
    expect(selected.some((item) => item.module_id === "src/weak")).toBe(false);
  });

  it("computes top-5 overlap ratio deterministically", () => {
    const scored = scoreCoreModules([
      candidate({ module_id: "a", module_path: "a", evidence: { critical_path: 1, change_activity: 0.9, dependency_centrality: 0.8, evidence_classes: ["critical_path", "change_activity"] } }),
      candidate({ module_id: "b", module_path: "b", evidence: { critical_path: 0.9, change_activity: 0.8, dependency_centrality: 0.7, evidence_classes: ["critical_path", "change_activity"] } }),
      candidate({ module_id: "c", module_path: "c", evidence: { critical_path: 0.8, change_activity: 0.7, dependency_centrality: 0.6, evidence_classes: ["critical_path", "change_activity"] } }),
      candidate({ module_id: "d", module_path: "d", evidence: { critical_path: 0.7, change_activity: 0.6, dependency_centrality: 0.5, evidence_classes: ["critical_path", "change_activity"] } }),
      candidate({ module_id: "e", module_path: "e", evidence: { critical_path: 0.6, change_activity: 0.5, dependency_centrality: 0.4, evidence_classes: ["critical_path", "change_activity"] } })
    ]);

    const overlap = top5OverlapRatio(scored, ["a", "x", "b", "y", "z"]);
    expect(overlap).toBeCloseTo(0.4, 4);
  });
});
