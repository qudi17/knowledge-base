import type {
  CoverageGap,
  CoverageManifest,
  PhaseExecutionRecord,
  PhaseScopePlan
} from "./types";

export interface PhaseExecutionRunResult {
  records: PhaseExecutionRecord[];
  completed_phase_ids: string[];
  remaining_scope_queue: string[];
  manifests: CoverageManifest[];
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

export async function runCoveragePhases(input: {
  plan: PhaseScopePlan;
  run_phase: (phase_id: string, scope: string[]) => Promise<PhaseRunnerOutput>;
  continue_on_safe_failure?: boolean;
  now_iso?: () => string;
}): Promise<PhaseExecutionRunResult> {
  const nowIso = input.now_iso ?? isoNow;
  const records: PhaseExecutionRecord[] = [];
  const completed: string[] = [];
  const remaining = input.plan.chunks.map((chunk) => chunk.phase_id);
  const manifests: CoverageManifest[] = [];

  for (const chunk of input.plan.chunks) {
    const started = nowIso();

    try {
      const output = await input.run_phase(chunk.phase_id, chunk.module_ids);
      const ended = nowIso();

      records.push({
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
        phase_id: chunk.phase_id,
        scope: [...chunk.module_ids],
        status: "failed",
        conclusions: [],
        gaps: [failureGap],
        started_at: started,
        ended_at: ended
      });

      if (!input.continue_on_safe_failure) {
        break;
      }

      remaining.shift();
    }
  }

  return {
    records,
    completed_phase_ids: completed,
    remaining_scope_queue: remaining,
    manifests
  };
}

export async function resumeCoveragePhasesFromCheckpoint(input: {
  plan: PhaseScopePlan;
  checkpoint: PhaseCheckpointState;
  run_phase: (phase_id: string, scope: string[]) => Promise<PhaseRunnerOutput>;
  continue_on_safe_failure?: boolean;
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
    now_iso: input.now_iso
  });

  return {
    ...resumed,
    completed_phase_ids: [...new Set([...input.checkpoint.completed_phase_ids, ...resumed.completed_phase_ids])]
  };
}
