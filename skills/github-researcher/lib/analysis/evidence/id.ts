import { createHash } from "node:crypto";

import type { EvidenceRecord } from "./types";

export interface BuildEvidenceIdInput {
  conclusion_id: string;
  path: string;
  line_start: number;
  line_end: number;
  signature?: string | null;
}

function normalizePath(path: string): string {
  return path.replace(/\\/g, "/").replace(/^\/+/, "").trim().toLowerCase();
}

function canonicalize(input: BuildEvidenceIdInput): string {
  const signature = (input.signature ?? "").trim().toLowerCase();
  return [
    input.conclusion_id.trim().toLowerCase(),
    normalizePath(input.path),
    String(input.line_start),
    String(input.line_end),
    signature
  ].join("|");
}

export function buildEvidenceId(input: BuildEvidenceIdInput): string {
  const hash = createHash("sha256").update(canonicalize(input)).digest("hex");
  return `evid_${hash.slice(0, 16)}`;
}

export function sortEvidenceRecordsDeterministically(records: EvidenceRecord[]): EvidenceRecord[] {
  return [...records].sort((a, b) => {
    const byConclusion = a.conclusion_id.localeCompare(b.conclusion_id);
    if (byConclusion !== 0) {
      return byConclusion;
    }

    const byEvidenceId = a.evidence_id.localeCompare(b.evidence_id);
    if (byEvidenceId !== 0) {
      return byEvidenceId;
    }

    const byPath = a.path.localeCompare(b.path);
    if (byPath !== 0) {
      return byPath;
    }

    const aStart = a.citations[0]?.line_start ?? Number.MAX_SAFE_INTEGER;
    const bStart = b.citations[0]?.line_start ?? Number.MAX_SAFE_INTEGER;
    if (aStart !== bStart) {
      return aStart - bStart;
    }

    return a.generated_at.localeCompare(b.generated_at);
  });
}
