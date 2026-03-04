import { latestIncomplete, saveCheckpoint, type CheckpointRecord } from "./checkpoint-store";
import { emitProgress, buildFinalSummary, type ProgressEvent, type ProgressReporterState } from "./progress-reporter";
import { resolveStartMode } from "./resume-engine";
import { createRunController } from "./run-controller";
import type { FailureContext, TerminalReason } from "./types";

export interface ReliabilityStage<TInput, TResult = unknown> {
  name: string;
  run: (context: { input: TInput; stage_index: number; stage_name: string }, attempt: number) => Promise<TResult>;
}

export interface ReliabilityRunInput<TInput> {
  run_id: string;
  input: TInput;
  input_fingerprint: string;
  stages: ReliabilityStage<TInput>[];
  started_at_iso?: string;
  now_ms?: () => number;
  progress_sink?: (event: ProgressEvent) => void;
}

export interface ReliabilityRunResult {
  run_id: string;
  status: "completed" | "failed";
  start_mode: "new" | "resume";
  terminal_reason: TerminalReason;
  transition_trace: string[];
  summary: ReturnType<typeof buildFinalSummary>;
  outputs: Record<string, unknown>;
}

function toIsoFromNow(nowMs: number): string {
  return new Date(nowMs).toISOString();
}

function readStageIndex(record: CheckpointRecord | null): number {
  if (!record) {
    return 0;
  }

  const raw = record.progress_snapshot.stage_index;
  if (typeof raw !== "number" || Number.isNaN(raw)) {
    return 0;
  }

  return raw + 1;
}

function safeFailureFromError(error: unknown, stage: string): FailureContext {
  if (typeof error === "object" && error !== null) {
    const source = error as Partial<FailureContext> & { message?: string };
    return {
      failure_class: source.failure_class ?? "hard_failure",
      message: source.message ?? "Stage failed",
      stage: source.stage ?? stage,
      attempt: source.attempt ?? 1,
      status_code: source.status_code,
      diagnostics: source.diagnostics
    };
  }

  return {
    failure_class: "hard_failure",
    message: String(error),
    stage,
    attempt: 1
  };
}

function emit(
  runId: string,
  stage: string,
  state: string,
  kind: "transition" | "cadence" | "terminal",
  nowMs: number,
  reporterState: ProgressReporterState,
  sink?: (event: ProgressEvent) => void,
  extra?: { terminal_reason?: TerminalReason; failure_context?: FailureContext; message?: string; attempt?: number }
): ProgressReporterState {
  const emitted = emitProgress({
    run_id: runId,
    stage,
    state,
    kind,
    now_ms: nowMs,
    now_iso: toIsoFromNow(nowMs),
    last_emit_at_ms: reporterState.last_emit_at_ms,
    terminal_reason: extra?.terminal_reason,
    failure_context: extra?.failure_context,
    message: extra?.message,
    attempt: extra?.attempt
  });

  if (emitted.emitted && emitted.event && sink) {
    sink(emitted.event);
  }

  return emitted.state;
}

export async function runWithReliability<TInput>(
  input: ReliabilityRunInput<TInput>
): Promise<ReliabilityRunResult> {
  const now = input.now_ms ?? (() => Date.now());
  const controller = createRunController(input.run_id);
  let reporterState: ProgressReporterState = { last_emit_at_ms: 0 };

  const startDecision = resolveStartMode(input.run_id, input.input_fingerprint);
  const startMode = startDecision.type;
  const resumeSource = startMode === "resume" ? startDecision.checkpoint : latestIncomplete(input.run_id);
  const startIndex = readStageIndex(resumeSource);

  const outputs: Record<string, unknown> = {};
  const failures: FailureContext[] = [];
  let totalAttempts = 0;
  let retriedStages = 0;
  let exhaustedStages = 0;

  for (let stageIndex = startIndex; stageIndex < input.stages.length; stageIndex += 1) {
    const stage = input.stages[stageIndex];
    const stageStartedAtMs = now();

    saveCheckpoint({
      run_id: input.run_id,
      stage: stage.name,
      timestamp: toIsoFromNow(stageStartedAtMs),
      state: "running",
      input_fingerprint: input.input_fingerprint,
      progress_snapshot: {
        stage_index: stageIndex,
        stage_name: stage.name,
        mode: startMode
      }
    });

    reporterState = emit(
      input.run_id,
      stage.name,
      "running",
      "transition",
      stageStartedAtMs,
      reporterState,
      input.progress_sink,
      { message: `enter_stage:${stage.name}` }
    );

    const stageResult = await controller.executeStage({
      name: stage.name,
      run: async (attempt) => {
        totalAttempts += 1;
        if (attempt > 1) {
          retriedStages += 1;
          reporterState = emit(
            input.run_id,
            stage.name,
            "retrying",
            "transition",
            now(),
            reporterState,
            input.progress_sink,
            { attempt, message: `retry_attempt:${attempt}` }
          );
        }

        reporterState = emit(input.run_id, stage.name, "running", "cadence", now(), reporterState, input.progress_sink, {
          attempt,
          message: `progress:${stage.name}`
        });

        return stage.run(
          {
            input: input.input,
            stage_index: stageIndex,
            stage_name: stage.name
          },
          attempt
        );
      }
    });

    if (!stageResult.ok) {
      const snapshot = controller.snapshot();
      exhaustedStages += 1;

      const failure =
        snapshot.failure_context ??
        safeFailureFromError({ message: "stage failed without explicit context" }, stage.name);

      failures.push(failure);

      const failedAtMs = now();
      saveCheckpoint({
        run_id: input.run_id,
        stage: stage.name,
        timestamp: toIsoFromNow(failedAtMs),
        state: "failed",
        input_fingerprint: input.input_fingerprint,
        progress_snapshot: {
          stage_index: stageIndex,
          stage_name: stage.name,
          mode: startMode
        },
        error_context: failure
      });

      reporterState = emit(
        input.run_id,
        stage.name,
        "failed",
        "terminal",
        failedAtMs,
        reporterState,
        input.progress_sink,
        {
          attempt: failure.attempt,
          failure_context: failure,
          terminal_reason: snapshot.terminal_reason ?? "transient_exhausted",
          message: `terminal_failure:${stage.name}`
        }
      );

      const summary = buildFinalSummary({
        run_id: input.run_id,
        conclusion: "Run failed before reaching all planned stages.",
        terminal_reason: snapshot.terminal_reason ?? "transient_exhausted",
        transition_trace: snapshot.transition_trace,
        retry_statistics: {
          total_attempts: totalAttempts,
          retried_stages: retriedStages,
          exhausted_stages: exhaustedStages
        },
        failures
      });

      return {
        run_id: input.run_id,
        status: "failed",
        start_mode: startMode,
        terminal_reason: snapshot.terminal_reason ?? "transient_exhausted",
        transition_trace: snapshot.transition_trace,
        summary,
        outputs
      };
    }

    outputs[stage.name] = stageResult.value;

    const stageCompletedAtMs = now();
    saveCheckpoint({
      run_id: input.run_id,
      stage: stage.name,
      timestamp: toIsoFromNow(stageCompletedAtMs),
      state: "paused",
      input_fingerprint: input.input_fingerprint,
      progress_snapshot: {
        stage_index: stageIndex,
        stage_name: stage.name,
        mode: startMode
      }
    });

    reporterState = emit(
      input.run_id,
      stage.name,
      "paused",
      "transition",
      stageCompletedAtMs,
      reporterState,
      input.progress_sink,
      { message: `stage_complete:${stage.name}` }
    );
  }

  controller.complete();
  const doneAtMs = now();
  saveCheckpoint({
    run_id: input.run_id,
    stage: "run",
    timestamp: toIsoFromNow(doneAtMs),
    state: "completed",
    input_fingerprint: input.input_fingerprint,
    progress_snapshot: {
      stage_index: input.stages.length - 1,
      stage_name: "run",
      mode: startMode,
      outputs
    }
  });

  reporterState = emit(input.run_id, "run", "completed", "terminal", doneAtMs, reporterState, input.progress_sink, {
    terminal_reason: "completed",
    message: "run_complete"
  });

  const snapshot = controller.snapshot();
  const summary = buildFinalSummary({
    run_id: input.run_id,
    conclusion: "Run completed and reached terminal completion state.",
    terminal_reason: "completed",
    transition_trace: snapshot.transition_trace,
    retry_statistics: {
      total_attempts: totalAttempts,
      retried_stages: retriedStages,
      exhausted_stages: exhaustedStages
    },
    failures
  });

  return {
    run_id: input.run_id,
    status: "completed",
    start_mode: startMode,
    terminal_reason: "completed",
    transition_trace: snapshot.transition_trace,
    summary,
    outputs
  };
}
