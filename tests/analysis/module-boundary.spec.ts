import { describe, expect, it } from "vitest";

import { extractModuleCandidates } from "../../skills/github-researcher/lib/analysis/core/module-boundary";

describe("module boundary extraction", () => {
  it("extracts deterministic candidates and excludes test/example/script dirs by default", () => {
    const candidates = extractModuleCandidates([
      {
        module_path: "src/core/engine",
        responsibility: "engine",
        entry_points: ["run"],
        evidence: {
          critical_path: 0.8,
          evidence_classes: ["critical_path", "dependency_centrality"]
        }
      },
      {
        module_path: "tests/core/engine",
        responsibility: "tests",
        entry_points: ["spec"],
        evidence: {
          critical_path: 1,
          evidence_classes: ["critical_path", "change_activity"]
        }
      },
      {
        module_path: "examples/quickstart",
        responsibility: "example",
        entry_points: ["main"],
        evidence: {
          critical_path: 1,
          evidence_classes: ["critical_path", "change_activity"]
        }
      }
    ]);

    expect(candidates.length).toBe(1);
    expect(candidates[0].module_id).toBe("src/core/engine");
  });

  it("merges aliases and unions entry points/evidence classes", () => {
    const candidates = extractModuleCandidates([
      {
        module_path: "src/core/engine",
        responsibility: "engine",
        entry_points: ["run"],
        evidence: {
          critical_path: 0.8,
          change_activity: 0.5,
          dependency_centrality: 0.7,
          evidence_classes: ["critical_path", "change_activity"]
        }
      },
      {
        module_path: "src/core/runtime",
        alias_of: "src/core/engine",
        responsibility: "runtime alias",
        entry_points: ["bootstrap"],
        evidence: {
          critical_path: 0.7,
          change_activity: 0.6,
          dependency_centrality: 0.9,
          evidence_classes: ["dependency_centrality"]
        }
      }
    ]);

    expect(candidates.length).toBe(1);
    expect(candidates[0].entry_points).toEqual(["bootstrap", "run"]);
    expect(candidates[0].evidence.evidence_classes).toEqual([
      "change_activity",
      "critical_path",
      "dependency_centrality"
    ]);
    expect(candidates[0].evidence.dependency_centrality).toBe(0.9);
  });
});
