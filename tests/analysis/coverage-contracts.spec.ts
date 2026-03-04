import { describe, expect, it } from "vitest";

import { buildCoverageManifestSnapshot, parseCoverageManifestSnapshot } from "../../skills/github-researcher/lib/analysis/core/artifacts";
import type { CoverageManifest } from "../../skills/github-researcher/lib/analysis/coverage/types";

describe("coverage contracts", () => {
  it("round-trips coverage snapshot payload deterministically", () => {
    const manifest: CoverageManifest = {
      phase_id: "06.1",
      generated_at: "2026-03-04T00:00:00.000Z",
      entries: [
        {
          phase_id: "06.1",
          module_id: "src/core",
          path: "src/core/index.ts",
          status: "scanned"
        }
      ],
      gaps: [
        {
          phase_id: "06.1",
          module_id: "src/core",
          path: "src/core/legacy.ts",
          cause: "deferred_scope",
          impact: "low",
          reason: "deferred"
        }
      ],
      counters: {
        candidate_files: 2,
        scanned_files: 1,
        excluded_files: 0,
        unresolved_files: 0,
        deferred_files: 1
      }
    };

    const snapshot = buildCoverageManifestSnapshot(manifest, "2026-03-04T01:00:00.000Z");
    const parsed = parseCoverageManifestSnapshot(JSON.stringify(snapshot));

    expect(parsed.phase).toBe("06");
    expect(parsed.manifest.phase_id).toBe("06.1");
    expect(parsed.manifest.entries[0].path).toBe("src/core/index.ts");
  });

  it("rejects invalid phase snapshot payload", () => {
    expect(() => parseCoverageManifestSnapshot(JSON.stringify({ phase: "05", manifest: { entries: [] } }))).toThrow(
      "Invalid coverage snapshot phase."
    );
  });
});
