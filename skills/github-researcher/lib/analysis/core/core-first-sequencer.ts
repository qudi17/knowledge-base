import type { CoreFirstGateInput } from "./types";

export type CoreStage = "entry_modules" | "core_business" | "supporting_modules" | "workflow_reconstruction" | "snapshot_freeze" | "broad_scan";

export interface SequenceState {
  completed_stages: CoreStage[];
  next_stage: CoreStage;
  transition_allowed: boolean;
  revalidation_required: boolean;
}

export interface CorePhaseOrderInput {
  module_id: string;
  stage: Exclude<CoreStage, "workflow_reconstruction" | "snapshot_freeze" | "broad_scan">;
  weight?: number;
}

const ORDER: CoreStage[] = [
  "entry_modules",
  "core_business",
  "supporting_modules",
  "workflow_reconstruction",
  "snapshot_freeze",
  "broad_scan"
];

function nextStageFrom(completed: CoreStage[]): CoreStage {
  for (const stage of ORDER) {
    if (!completed.includes(stage)) return stage;
  }
  return "broad_scan";
}

export function shouldTransitionToBroadScan(input: CoreFirstGateInput): { allowed: boolean; reason?: string } {
  if (!input.core_set_complete) return { allowed: false, reason: "core_set_incomplete" };
  if (!input.role_explanations_complete) return { allowed: false, reason: "role_explanations_incomplete" };
  if (input.accepted_workflow_count < 1) return { allowed: false, reason: "workflow_minimum_unmet" };
  if (!input.snapshot_frozen) return { allowed: false, reason: "snapshot_not_frozen" };

  if (input.budget_used_ratio > 0.7) {
    return { allowed: false, reason: "core_budget_exceeded" };
  }

  if (input.budget_used_ratio > 0.6 && !input.budget_extension_reason) {
    return { allowed: false, reason: "budget_extension_reason_missing" };
  }

  return { allowed: true };
}

export function runCoreFirstSequence(params: {
  completed_stages: CoreStage[];
  gates: CoreFirstGateInput;
  conflict_detected?: boolean;
}): SequenceState {
  const deduped = [...new Set(params.completed_stages)];
  const transition = shouldTransitionToBroadScan(params.gates);

  const next = nextStageFrom(deduped);

  if (next === "broad_scan" && !transition.allowed) {
    return {
      completed_stages: deduped,
      next_stage: "snapshot_freeze",
      transition_allowed: false,
      revalidation_required: Boolean(params.conflict_detected)
    };
  }

  return {
    completed_stages: deduped,
    next_stage: next,
    transition_allowed: transition.allowed,
    revalidation_required: Boolean(params.conflict_detected)
  };
}

export function preserveCoreFirstPhaseOrder(modules: CorePhaseOrderInput[]): string[] {
  const stageOrder: Record<CorePhaseOrderInput["stage"], number> = {
    entry_modules: 0,
    core_business: 1,
    supporting_modules: 2
  };

  return [...modules]
    .sort((a, b) => {
      const stageDiff = stageOrder[a.stage] - stageOrder[b.stage];
      if (stageDiff !== 0) return stageDiff;
      const weightDiff = (b.weight ?? 0) - (a.weight ?? 0);
      if (weightDiff !== 0) return weightDiff;
      return a.module_id.localeCompare(b.module_id);
    })
    .map((item) => item.module_id);
}
