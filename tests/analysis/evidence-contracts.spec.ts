import { describe, expect, it } from "vitest";

import { buildEvidenceSnapshotArtifact, parseEvidenceSnapshotArtifact } from "../../skills/github-researcher/lib/analysis/core/artifacts";
import { buildEvidenceId, sortEvidenceRecordsDeterministically } from "../../skills/github-researcher/lib/analysis/evidence/id";
import type { EvidenceRecord } from "../../skills/github-researcher/lib/analysis/evidence/types";
import { validateEvidenceForConclusions, validateEvidenceRecord } from "../../skills/github-researcher/lib/analysis/evidence/types";

function makeRecord(conclusion_id: string, path: string, start: number, end: number): EvidenceRecord {
  const evidence_id = buildEvidenceId({
    conclusion_id,
    path,
    line_start: start,
    line_end: end,
    signature: "function loadRepo()"
  });

  return {
    evidence_id,
    conclusion_id,
    key: `${conclusion_id}:key`,
    phase_id: "07",
    tier: "primary",
    path,
    module_id: "analysis/evidence",
    generated_at: "2026-03-04T00:00:00.000Z",
    citations: [
      {
        line_start: start,
        line_end: end,
        anchor: `#L${start}-L${end}`,
        anchor_strategy: "line_anchor",
        anchor_tier_used: 1,
        sha_url: `https://github.com/owner/repo/blob/abc123/${path}#L${start}-L${end}`,
        default_branch_url: `https://github.com/owner/repo/blob/main/${path}#L${start}-L${end}`,
        sha_status: { available: true },
        default_branch_status: { available: true }
      }
    ],
    snippets: [
      {
        snippet_id: `${evidence_id}:1`,
        label: "Mainline flow",
        kind: "mainline",
        path,
        function_signature: "function loadRepo()",
        line_start: start,
        line_end: end,
        content: "function loadRepo() { return true; }",
        segment_index: 1,
        segment_total: 1,
        omitted_ranges: [],
        language: "ts"
      }
    ],
    validation_status: "valid",
    validation_reasons: ["ok"]
  };
}

describe("evidence contracts", () => {
  it("builds stable evidence_id values and deterministic sort order", () => {
    const a = makeRecord("conclusion_a", "src/a.ts", 10, 20);
    const b = makeRecord("conclusion_a", "src/b.ts", 4, 12);
    const c = makeRecord("conclusion_b", "src/c.ts", 1, 3);

    const first = buildEvidenceId({
      conclusion_id: "conclusion_a",
      path: "src/a.ts",
      line_start: 10,
      line_end: 20,
      signature: "function loadRepo()"
    });
    const second = buildEvidenceId({
      conclusion_id: "conclusion_a",
      path: "src/a.ts",
      line_start: 10,
      line_end: 20,
      signature: "function loadRepo()"
    });

    expect(first).toBe(second);
    expect(first).toMatch(/^evid_[a-f0-9]{16}$/);

    const sorted = sortEvidenceRecordsDeterministically([c, b, a]);
    expect(sorted.map((record) => record.conclusion_id)).toEqual(["conclusion_a", "conclusion_a", "conclusion_b"]);
    expect(sorted[0].evidence_id <= sorted[1].evidence_id).toBe(true);
  });

  it("enforces per-record validation invariants for citations and snippets", () => {
    const validRecord = makeRecord("conclusion_valid", "src/ok.ts", 2, 8);
    const validResult = validateEvidenceRecord(validRecord, true);

    expect(validResult.valid).toBe(true);
    expect(validResult.reasons).toEqual(["ok"]);

    const invalidRecord = makeRecord("conclusion_invalid", "src/bad.ts", 3, 9);
    invalidRecord.citations[0].anchor = "#bad";
    invalidRecord.snippets[0].function_signature = null;
    invalidRecord.citations[0].default_branch_url = null;
    invalidRecord.citations[0].default_branch_status = { available: false, reason: "branch_unknown" };

    const invalidResult = validateEvidenceRecord(invalidRecord, true);
    expect(invalidResult.valid).toBe(false);
    expect(invalidResult.reasons).toContain("missing_line_anchor");
    expect(invalidResult.reasons).toContain("missing_function_level_snippet");
    expect(invalidResult.reasons).toContain("missing_default_branch_link");
  });

  it("guarantees every key conclusion is linked to at least one evidence record", () => {
    const rec1 = makeRecord("c1", "src/c1.ts", 5, 7);
    const rec2 = makeRecord("c2", "src/c2.ts", 11, 19);

    const passing = validateEvidenceForConclusions({
      key_conclusions: [
        { conclusion_id: "c1", key: "entry" },
        { conclusion_id: "c2", key: "retry" }
      ],
      evidence_records: [rec1, rec2],
      require_default_branch_link: true
    });
    expect(passing.valid).toBe(true);

    const failing = validateEvidenceForConclusions({
      key_conclusions: [
        { conclusion_id: "c1", key: "entry" },
        { conclusion_id: "c3", key: "error-path" }
      ],
      evidence_records: [rec1],
      require_default_branch_link: true
    });
    expect(failing.valid).toBe(false);
    expect(failing.reasons).toContain("missing_evidence_for_conclusion");
  });

  it("round-trips evidence snapshot serialize/parse deterministically", () => {
    const records = [
      makeRecord("c2", "src/b.ts", 10, 12),
      makeRecord("c1", "src/a.ts", 1, 3)
    ];

    const sorted = sortEvidenceRecordsDeterministically(records);
    const validation = validateEvidenceForConclusions({
      key_conclusions: [
        { conclusion_id: "c1", key: "main" },
        { conclusion_id: "c2", key: "retry" }
      ],
      evidence_records: sorted,
      require_default_branch_link: true
    });

    const snapshot = buildEvidenceSnapshotArtifact(sorted, validation, "2026-03-04T03:00:00.000Z");
    const parsed = parseEvidenceSnapshotArtifact(JSON.stringify(snapshot));

    expect(parsed.phase).toBe("07");
    expect(parsed.snapshot_version).toBe(1);
    expect(parsed.records[0].conclusion_id).toBe("c1");
    expect(parsed.records[1].conclusion_id).toBe("c2");
    expect(parsed.validation.valid).toBe(true);
  });
});
