import type {
  ConflictSourceRef,
  CoverageGap,
  MergedConclusionRecord,
  MergedCoverageOutput,
  PhaseExecutionRecord
} from "./types";

function confidenceScore(level: "high" | "medium" | "low"): number {
  if (level === "high") return 3;
  if (level === "medium") return 2;
  return 1;
}

function selectConfidence(levels: Array<"high" | "medium" | "low">): "high" | "medium" | "low" {
  return levels.reduce((best, next) => (confidenceScore(next) > confidenceScore(best) ? next : best), "low");
}

export function adjudicateConflictingConclusions(input: {
  key: string;
  records: Array<{
    statement: string;
    confidence: "high" | "medium" | "low";
    evidence_ids: string[];
    source: ConflictSourceRef;
  }>;
}): MergedConclusionRecord {
  const sorted = [...input.records].sort((a, b) => {
    const conf = confidenceScore(b.confidence) - confidenceScore(a.confidence);
    if (conf !== 0) return conf;
    return b.evidence_ids.length - a.evidence_ids.length;
  });

  const chosen = sorted[0];
  const conflictHistory = sorted.slice(1).map((item) => item.statement);
  const sources = sorted.map((item) => item.source);

  return {
    key: input.key,
    statement: chosen.statement,
    confidence: selectConfidence(sorted.map((item) => item.confidence)),
    evidence_ids: [...new Set(sorted.flatMap((item) => item.evidence_ids))].sort(),
    conflict_history: conflictHistory,
    conflict_sources: sources,
    adjudication_rationale:
      conflictHistory.length === 0
        ? "single_source_conclusion"
        : "selected highest-confidence statement and preserved alternatives with lineage"
  };
}

export function mergeCoveragePhaseOutputs(input: {
  phase_records: PhaseExecutionRecord[];
}): MergedCoverageOutput {
  const conclusionBuckets = new Map<
    string,
    Array<{
      statement: string;
      confidence: "high" | "medium" | "low";
      evidence_ids: string[];
      source: ConflictSourceRef;
    }>
  >();

  const allGaps: CoverageGap[] = [];
  const phaseStatements: string[] = [];

  for (const record of input.phase_records) {
    phaseStatements.push(`${record.phase_id}: ${record.status} (${record.scope.length} modules)`);
    allGaps.push(...record.gaps);

    for (const conclusion of record.conclusions) {
      const current = conclusionBuckets.get(conclusion.key) ?? [];
      current.push({
        statement: conclusion.statement,
        confidence: conclusion.confidence,
        evidence_ids: conclusion.evidence_ids,
        source: {
          phase_id: record.phase_id,
          phase_record_id: record.phase_record_id,
          conclusion_id: conclusion.conclusion_id,
          evidence_ids: conclusion.evidence_ids
        }
      });
      conclusionBuckets.set(conclusion.key, current);
    }
  }

  const mergedConclusions = [...conclusionBuckets.entries()]
    .map(([key, records]) => adjudicateConflictingConclusions({ key, records }))
    .sort((a, b) => a.key.localeCompare(b.key));

  const mergedGaps = allGaps.sort((a, b) => {
    if (a.phase_id !== b.phase_id) return a.phase_id.localeCompare(b.phase_id);
    if (a.module_id !== b.module_id) return a.module_id.localeCompare(b.module_id);
    return a.path.localeCompare(b.path);
  });

  return {
    global_coverage_statement: `Merged ${input.phase_records.length} phase outputs with ${mergedConclusions.length} deduplicated conclusions and ${mergedGaps.length} known gaps.`,
    per_phase_coverage_statements: phaseStatements,
    merged_conclusions: mergedConclusions,
    merged_gaps: mergedGaps
  };
}
