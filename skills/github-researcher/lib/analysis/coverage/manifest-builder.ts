import { classifyCoverageScopeEntry, type CoverageScopeInput } from "./scope-policy";
import type { CoverageCounters, CoverageGap, CoverageManifest } from "./types";

export interface BuildCoverageManifestInput {
  phase_id: string;
  files: Array<Pick<CoverageScopeInput, "path" | "parseable" | "deferred">>;
  generated_at?: string;
}

function isoNow(): string {
  return new Date().toISOString();
}

function zeroCounters(): CoverageCounters {
  return {
    candidate_files: 0,
    scanned_files: 0,
    excluded_files: 0,
    unresolved_files: 0,
    deferred_files: 0
  };
}

function gapFromEntry(entry: ReturnType<typeof classifyCoverageScopeEntry>): CoverageGap | null {
  if (entry.status === "unresolved") {
    return {
      phase_id: entry.phase_id,
      module_id: entry.module_id,
      path: entry.path,
      cause: "unparseable",
      impact: "medium",
      reason: entry.reason ?? "unparseable"
    };
  }

  if (entry.status === "deferred") {
    return {
      phase_id: entry.phase_id,
      module_id: entry.module_id,
      path: entry.path,
      cause: "deferred_scope",
      impact: "low",
      reason: entry.reason ?? "deferred_scope"
    };
  }

  return null;
}

export function buildCoverageManifest(input: BuildCoverageManifestInput): CoverageManifest {
  const entries = input.files
    .map((file) =>
      classifyCoverageScopeEntry({
        phase_id: input.phase_id,
        path: file.path,
        parseable: file.parseable,
        deferred: file.deferred
      })
    )
    .sort((a, b) => a.module_id.localeCompare(b.module_id) || a.path.localeCompare(b.path));

  const counters = zeroCounters();
  const gaps: CoverageGap[] = [];

  for (const entry of entries) {
    counters.candidate_files += 1;

    if (entry.status === "scanned") counters.scanned_files += 1;
    if (entry.status === "excluded") counters.excluded_files += 1;
    if (entry.status === "unresolved") counters.unresolved_files += 1;
    if (entry.status === "deferred") counters.deferred_files += 1;

    const gap = gapFromEntry(entry);
    if (gap) {
      gaps.push(gap);
    }
  }

  const manifest: CoverageManifest = {
    phase_id: input.phase_id,
    generated_at: input.generated_at ?? isoNow(),
    entries,
    gaps: gaps.sort((a, b) => a.module_id.localeCompare(b.module_id) || a.path.localeCompare(b.path)),
    counters
  };

  return reconcileCoverageCounters(manifest);
}

export function reconcileCoverageCounters(manifest: CoverageManifest): CoverageManifest {
  const expected =
    manifest.counters.scanned_files +
    manifest.counters.excluded_files +
    manifest.counters.unresolved_files +
    manifest.counters.deferred_files;

  if (manifest.counters.candidate_files === expected) {
    return manifest;
  }

  return {
    ...manifest,
    counters: {
      ...manifest.counters,
      candidate_files: expected
    }
  };
}
