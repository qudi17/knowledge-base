import { describe, expect, it } from "vitest";

import { buildCoverageManifest } from "../../skills/github-researcher/lib/analysis/coverage/manifest-builder";

describe("coverage manifest", () => {
  it("classifies and reconciles counters deterministically", () => {
    const manifest = buildCoverageManifest({
      phase_id: "06.1",
      files: [
        { path: "src/core/index.ts", parseable: true },
        { path: "src/core/parser.ts", parseable: false },
        { path: "dist/bundle.js", parseable: true },
        { path: "src/legacy/old.ts", deferred: true }
      ]
    });

    expect(manifest.entries.map((entry) => entry.path)).toEqual([
      "dist/bundle.js",
      "src/core/index.ts",
      "src/core/parser.ts",
      "src/legacy/old.ts"
    ]);

    expect(manifest.counters).toEqual({
      candidate_files: 4,
      scanned_files: 1,
      excluded_files: 1,
      unresolved_files: 1,
      deferred_files: 1
    });
  });

  it("records unresolved and deferred files as known gaps", () => {
    const manifest = buildCoverageManifest({
      phase_id: "06.2",
      files: [
        { path: "src/a.ts", parseable: false },
        { path: "src/b.ts", deferred: true },
        { path: "src/c.ts" }
      ]
    });

    expect(manifest.gaps.length).toBe(2);
    expect(manifest.gaps[0].cause).toBe("unparseable");
    expect(manifest.gaps[1].cause).toBe("deferred_scope");
  });
});
