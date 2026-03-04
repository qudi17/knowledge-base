import { buildCoverageManifest } from "./coverage/manifest-builder";
import { mergeCoveragePhaseOutputs } from "./coverage/merge-coherence";
import { buildPhaseScopePlan, shouldUsePhasedCoverageExecution } from "./coverage/phase-planner";
import { runCoveragePhases, type PhaseRunnerOutput } from "./coverage/phased-execution";
import { buildCoverageSummary } from "./coverage/summary";
import type { MergedCoverageOutput, PhaseExecutionRecord } from "./coverage/types";

export interface RuntimeModuleInput {
  module_id: string;
  file_count: number;
  core_rank?: number;
}

export interface RuntimeFileInput {
  path: string;
  parseable?: boolean;
  deferred?: boolean;
}

export interface AnalysisRuntimeInput {
  run_id: string;
  modules: RuntimeModuleInput[];
  files: RuntimeFileInput[];
  large_repo_hint?: {
    candidate_files: number;
    module_count: number;
    estimated_tokens?: number;
  };
  run_phase: (phase_id: string, scope: string[]) => Promise<PhaseRunnerOutput>;
}

export interface AnalysisRuntimeOutput {
  phased: boolean;
  coverage_summary: ReturnType<typeof buildCoverageSummary>;
  phase_records: PhaseExecutionRecord[];
  merged_output: MergedCoverageOutput;
  phase_appendix: string[];
}

function singlePassRecord(runId: string, moduleIds: string[]): PhaseExecutionRecord {
  const at = new Date().toISOString();
  return {
    phase_record_id: `${runId}.single::${at}`,
    phase_id: `${runId}.single`,
    scope: moduleIds,
    status: "completed",
    conclusions: [],
    gaps: [],
    started_at: at,
    ended_at: at
  };
}

export async function runAnalysisWithCoverage(input: AnalysisRuntimeInput): Promise<AnalysisRuntimeOutput> {
  const manifest = buildCoverageManifest({
    phase_id: `${input.run_id}.manifest`,
    files: input.files
  });

  const largeRepo = shouldUsePhasedCoverageExecution(
    input.large_repo_hint ?? {
      candidate_files: input.files.length,
      module_count: input.modules.length
    }
  );

  if (!largeRepo) {
    const mergedOutput = mergeCoveragePhaseOutputs({
      phase_records: [singlePassRecord(input.run_id, input.modules.map((m) => m.module_id))]
    });

    return {
      phased: false,
      coverage_summary: buildCoverageSummary(manifest),
      phase_records: [],
      merged_output: mergedOutput,
      phase_appendix: mergedOutput.per_phase_coverage_statements
    };
  }

  const scopePlan = buildPhaseScopePlan({
    phase_prefix: input.run_id,
    modules: input.modules,
    force_phased: true
  });

  const phased = await runCoveragePhases({
    plan: scopePlan,
    run_phase: input.run_phase,
    continue_on_safe_failure: true
  });

  const mergedOutput = mergeCoveragePhaseOutputs({
    phase_records: phased.records
  });

  return {
    phased: true,
    coverage_summary: buildCoverageSummary(manifest),
    phase_records: phased.records,
    merged_output: mergedOutput,
    phase_appendix: mergedOutput.per_phase_coverage_statements
  };
}
