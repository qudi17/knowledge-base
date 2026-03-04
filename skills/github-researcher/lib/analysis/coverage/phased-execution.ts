import type {
  CoverageGap,
  CoverageManifest,
  PhaseExecutionRecord,
  PhaseScopePlan,
  SafeContinueDecision,
  SafeContinueEvaluationInput
} from "./types";

export interface PhaseExecutionRunResult {
  records: PhaseExecutionRecord[];
  completed_phase_ids: string[];
  remaining_scope_queue: string[];
  manifests: CoverageManifest[];
  safe_continue_decisions: SafeContinueDecision[];
  terminal_reason?: string;
}

export interface PhaseCheckpointState {
  completed_phase_ids: string[];
  remaining_scope_queue: string[];
}

export interface PhaseRunnerOutput {
  conclusions: PhaseExecutionRecord["conclusions"];
  gaps: CoverageGap[];
  manifest?: CoverageManifest;
}

function isoNow(): string {
  return new Date().toISOString();
}

function normalizeError(error: unknown, phaseId: string): CoverageGap {
  if (typeof error === "object" && error !== null) {
    const cast = error as { message?: string };
    return {
      phase_id: phaseId,
      module_id: "phase-runtime",
      path: phaseId,
      cause: "execution_failure",
      impact: "medium",
      reason: cast.message ?? "phase execution failure"
    };
  }

  return {
    phase_id: phaseId,
    module_id: "phase-runtime",
    path: phaseId,
    cause: "execution_failure",
    impact: "medium",
    reason: String(error)
  };
}

export function evaluateSafeContinueCriteria(input: SafeContinueEvaluationInput): SafeContinueDecision {
  if (input.remaining_scope_count <= 0) {
    return {
      phase_id: input.phase_id,
      allowed: false,
      reason_code: "deny_no_remaining_scope",
      rationale: "No remaining scope chunks to continue."
    };
  }

  if (input.failure_gap.impact === "high") {
    return {
      phase_id: input.phase_id,
      allowed: false,
      reason_code: "deny_high_impact_failure",
      rationale: "High-impact failure requires terminal stop."
    };
  }

  if (input.failure_gap.cause === "deferred_scope") {
    return {
      phase_id: input.phase_id,
      allowed: true,
      reason_code: "allow_deferred_scope_failure",
      rationale: "Deferred-scope failure can continue with explicit gap record."
    };
  }

  if (input.failure_gap.impact === "low" || input.completed_phase_count > 0) {
    return {
      phase_id: input.phase_id,
      allowed: true,
      reason_code: "allow_low_impact_failure",
      rationale: "Failure impact is bounded and prior coverage already exists."
    };
  }

  return {
    phase_id: input.phase_id,
    allowed: false,
    reason_code: "deny_policy_default",
    rationale: "Policy default denied continuation for this failure profile."
  };
}

export async function runCoveragePhases(input: {
  plan: PhaseScopePlan;
  run_phase: (phase_id: string, scope: string[]) => Promise<PhaseRunnerOutput>;
  continue_on_safe_failure?: boolean;
  safe_continue_evaluator?: (input: SafeContinueEvaluationInput) => SafeContinueDecision;
  now_iso?: () => string;
}): Promise<PhaseExecutionRunResult> {
  const nowIso = input.now_iso ?? isoNow;
  const records: PhaseExecutionRecord[] = [];
  const completed: string[] = [];
  const remaining = input.plan.chunks.map((chunk) => chunk.phase_id);
  const manifests: CoverageManifest[] = [];
  const decisions: SafeContinueDecision[] = [];

  for (const chunk of input.plan.chunks) {
    const started = nowIso();
    const recordId = `${chunk.phase_id}::${started}`;

    try {
      const output = await input.run_phase(chunk.phase_id, chunk.module_ids);
      const ended = nowIso();

      records.push({
        phase_record_id: recordId,
        phase_id: chunk.phase_id,
        scope: [...chunk.module_ids],
        status: "completed",
        conclusions: output.conclusions,
        gaps: output.gaps,
        started_at: started,
        ended_at: ended
      });

      if (output.manifest) {
        manifests.push(output.manifest);
      }

      completed.push(chunk.phase_id);
      remaining.shift();
    } catch (error) {
      const ended = nowIso();
      const failureGap = normalizeError(error, chunk.phase_id);

      records.push({
        phase_record_id: recordId,
        phase_id: chunk.phase_id,
        scope: [...chunk.module_ids],
        status: "failed",
        conclusions: [],
        gaps: [failureGap],
        started_at: started,
        ended_at: ended
      });

      const decide = input.safe_continue_evaluator ?? evaluateSafeContinueCriteria;
      const decision = decide({
        phase_id: chunk.phase_id,
        failure_gap: failureGap,
        remaining_scope_count: Math.max(0, remaining.length - 1),
        completed_phase_count: completed.length
      });
      decisions.push(decision);

      if (!(input.continue_on_safe_failure && decision.allowed)) {
        return {
          records,
          completed_phase_ids: completed,
          remaining_scope_queue: remaining,
          manifests,
          safe_continue_decisions: decisions,
          terminal_reason: decision.reason_code
        };
      }

      remaining.shift();
    }
  }

  return {
    records,
    completed_phase_ids: completed,
    remaining_scope_queue: remaining,
    manifests,
    safe_continue_decisions: decisions
  };
}

export async function resumeCoveragePhasesFromCheckpoint(input: {
  plan: PhaseScopePlan;
  checkpoint: PhaseCheckpointState;
  run_phase: (phase_id: string, scope: string[]) => Promise<PhaseRunnerOutput>;
  continue_on_safe_failure?: boolean;
  safe_continue_evaluator?: (input: SafeContinueEvaluationInput) => SafeContinueDecision;
  now_iso?: () => string;
}): Promise<PhaseExecutionRunResult> {
  const pending = new Set(input.checkpoint.remaining_scope_queue);
  const filteredPlan: PhaseScopePlan = {
    ...input.plan,
    chunks: input.plan.chunks.filter((chunk) => pending.has(chunk.phase_id))
  };

  const resumed = await runCoveragePhases({
    plan: filteredPlan,
    run_phase: input.run_phase,
    continue_on_safe_failure: input.continue_on_safe_failure,
    safe_continue_evaluator: input.safe_continue_evaluator,
    now_iso: input.now_iso
  });

  return {
    ...resumed,
    completed_phase_ids: [...new Set([...input.checkpoint.completed_phase_ids, ...resumed.completed_phase_ids])]
  };
}
