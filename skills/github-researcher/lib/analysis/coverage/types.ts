export type CoverageQualityTier = "high" | "medium" | "low";

export type CoverageEntryStatus = "scanned" | "excluded" | "unresolved" | "deferred";

export type CoverageGapCause =
  | "unresolved"
  | "unparseable"
  | "excluded_policy"
  | "deferred_scope"
  | "execution_failure";

export type CoverageImpact = "high" | "medium" | "low";

export interface CoverageCounters {
  candidate_files: number;
  scanned_files: number;
  excluded_files: number;
  unresolved_files: number;
  deferred_files: number;
}

export interface CoverageManifestEntry {
  phase_id: string;
  module_id: string;
  path: string;
  status: CoverageEntryStatus;
  reason?: string;
}

export interface CoverageGap {
  phase_id: string;
  module_id: string;
  path: string;
  cause: CoverageGapCause;
  impact: CoverageImpact;
  reason: string;
}

export interface CoverageManifest {
  phase_id: string;
  generated_at: string;
  entries: CoverageManifestEntry[];
  gaps: CoverageGap[];
  counters: CoverageCounters;
}

export interface CoverageSummaryModuleRow {
  module_id: string;
  counters: CoverageCounters;
  files: CoverageManifestEntry[];
}

export interface CoverageGapGroup {
  cause: CoverageGapCause;
  impact: CoverageImpact;
  count: number;
  gaps: CoverageGap[];
}

export interface CoverageSummary {
  phase_id: string;
  quality_tier: CoverageQualityTier;
  headline: string;
  global_counters: CoverageCounters;
  module_rows: CoverageSummaryModuleRow[];
  known_gap_groups: CoverageGapGroup[];
}

export interface PhaseScopeChunk {
  phase_id: string;
  order_index: number;
  module_ids: string[];
  estimated_files: number;
}

export interface PhaseScopePlan {
  phased: boolean;
  reason: string;
  chunks: PhaseScopeChunk[];
}

export interface CoverageConclusion {
  conclusion_id: string;
  key: string;
  statement: string;
  confidence: CoverageQualityTier;
  evidence_ids: string[];
}

export interface PhaseExecutionRecord {
  phase_record_id: string;
  phase_id: string;
  scope: string[];
  status: "completed" | "failed";
  conclusions: CoverageConclusion[];
  gaps: CoverageGap[];
  started_at: string;
  ended_at: string;
}

export type SafeContinueReasonCode =
  | "allow_low_impact_failure"
  | "allow_deferred_scope_failure"
  | "deny_high_impact_failure"
  | "deny_no_remaining_scope"
  | "deny_policy_default";

export interface SafeContinueDecision {
  phase_id: string;
  allowed: boolean;
  reason_code: SafeContinueReasonCode;
  rationale: string;
}

export interface SafeContinueEvaluationInput {
  phase_id: string;
  failure_gap: CoverageGap;
  remaining_scope_count: number;
  completed_phase_count: number;
}

export interface ConflictSourceRef {
  phase_id: string;
  phase_record_id: string;
  conclusion_id: string;
  evidence_ids: string[];
}

export interface MergedConclusionRecord {
  key: string;
  statement: string;
  confidence: CoverageQualityTier;
  evidence_ids: string[];
  conflict_history: string[];
  conflict_sources: ConflictSourceRef[];
  adjudication_rationale: string;
}

export interface MergedCoverageOutput {
  global_coverage_statement: string;
  per_phase_coverage_statements: string[];
  merged_conclusions: MergedConclusionRecord[];
  merged_gaps: CoverageGap[];
}
