import type {
  CoverageCounters,
  CoverageGap,
  CoverageGapGroup,
  CoverageManifest,
  CoverageQualityTier,
  CoverageSummary,
  CoverageSummaryModuleRow
} from "./types";

function coverageRatio(counters: CoverageCounters): number {
  if (counters.candidate_files === 0) return 1;
  return counters.scanned_files / counters.candidate_files;
}

export function deriveCoverageQualityTier(counters: CoverageCounters): CoverageQualityTier {
  const ratio = coverageRatio(counters);
  const unresolvedRatio = counters.candidate_files === 0 ? 0 : counters.unresolved_files / counters.candidate_files;

  if (ratio >= 0.85 && unresolvedRatio <= 0.05) return "high";
  if (ratio >= 0.6 && unresolvedRatio <= 0.2) return "medium";
  return "low";
}

function groupKnownGaps(gaps: CoverageGap[]): CoverageGapGroup[] {
  const grouped = new Map<string, CoverageGapGroup>();

  for (const gap of gaps) {
    const key = `${gap.cause}::${gap.impact}`;
    const current = grouped.get(key);
    if (!current) {
      grouped.set(key, {
        cause: gap.cause,
        impact: gap.impact,
        count: 1,
        gaps: [gap]
      });
      continue;
    }

    current.count += 1;
    current.gaps.push(gap);
  }

  return [...grouped.values()]
    .map((group) => ({
      ...group,
      gaps: [...group.gaps].sort((a, b) => a.module_id.localeCompare(b.module_id) || a.path.localeCompare(b.path))
    }))
    .sort((a, b) => a.cause.localeCompare(b.cause) || a.impact.localeCompare(b.impact));
}

function moduleRows(manifest: CoverageManifest): CoverageSummaryModuleRow[] {
  const modules = new Map<string, CoverageSummaryModuleRow>();

  for (const entry of manifest.entries) {
    let row = modules.get(entry.module_id);
    if (!row) {
      row = {
        module_id: entry.module_id,
        counters: {
          candidate_files: 0,
          scanned_files: 0,
          excluded_files: 0,
          unresolved_files: 0,
          deferred_files: 0
        },
        files: []
      };
      modules.set(entry.module_id, row);
    }

    row.files.push(entry);
    row.counters.candidate_files += 1;
    if (entry.status === "scanned") row.counters.scanned_files += 1;
    if (entry.status === "excluded") row.counters.excluded_files += 1;
    if (entry.status === "unresolved") row.counters.unresolved_files += 1;
    if (entry.status === "deferred") row.counters.deferred_files += 1;
  }

  return [...modules.values()]
    .map((row) => ({
      ...row,
      files: row.files.sort((a, b) => a.path.localeCompare(b.path))
    }))
    .sort((a, b) => a.module_id.localeCompare(b.module_id));
}

export function buildCoverageSummary(manifest: CoverageManifest): CoverageSummary {
  const tier = deriveCoverageQualityTier(manifest.counters);
  const ratioPct = Math.round(coverageRatio(manifest.counters) * 100);

  return {
    phase_id: manifest.phase_id,
    quality_tier: tier,
    headline: `Coverage ${tier.toUpperCase()} (${ratioPct}% scanned, ${manifest.gaps.length} known gaps)`,
    global_counters: { ...manifest.counters },
    module_rows: moduleRows(manifest),
    known_gap_groups: groupKnownGaps(manifest.gaps)
  };
}
