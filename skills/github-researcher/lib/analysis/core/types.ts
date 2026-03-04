export type StabilityMarker = "stable" | "evolving";

export type EvidenceClass =
  | "critical_path"
  | "change_activity"
  | "dependency_centrality"
  | "entrypoint_reachability"
  | "manual_promotion";

export interface CoreEvidenceBundle {
  critical_path: number;
  change_activity: number;
  dependency_centrality: number;
  evidence_classes: EvidenceClass[];
}

export interface CoreModuleCandidate {
  module_id: string;
  module_path: string;
  responsibility: string;
  entry_points: string[];
  stability: StabilityMarker;
  invoked_by_core_flow?: boolean;
  manual_promotion_reason?: string;
  evidence: CoreEvidenceBundle;
}

export interface CoreSelectionConfig {
  weights: {
    critical_path: number;
    change_activity: number;
    dependency_centrality: number;
  };
  confidence_threshold: number;
}

export interface ScoredCoreModule extends CoreModuleCandidate {
  core_score: number;
  evidence_class_count: number;
  rationale: string;
  manually_promoted: boolean;
}

export interface CoreRoleExplanation {
  module_id: string;
  summary: string;
  entry_points: string[];
  stability: StabilityMarker;
  evidence_class_count: number;
  rationale: string;
}

export interface CoreSnapshotModule {
  module_id: string;
  module_path: string;
  core_score: number;
  entry_points: string[];
  stability: StabilityMarker;
  responsibility: string;
  evidence_class_count: number;
  rationale: string;
  role_summary: string;
  manually_promoted: boolean;
}

export interface CoreSnapshotArtifact {
  phase: "05";
  generated_at: string;
  selection_config: CoreSelectionConfig;
  modules: CoreSnapshotModule[];
  top5_overlap_target: number;
  frozen: boolean;
  snapshot_version: number;
  revalidation?: {
    reason: string;
    updated_at: string;
  };
}

export interface WorkflowNode {
  module_id: string;
  function_name?: string;
  kind: "mainline" | "exception";
}

export interface CoreWorkflow {
  workflow_id: string;
  nodes: WorkflowNode[];
  module_count: number;
  accepted: boolean;
  rejection_reason?: string;
}

export interface CoreFirstGateInput {
  core_set_complete: boolean;
  role_explanations_complete: boolean;
  accepted_workflow_count: number;
  snapshot_frozen: boolean;
  budget_used_ratio: number;
  budget_extension_reason?: string;
}
