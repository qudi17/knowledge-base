# Phase 2: Unattended Execution Reliability - Research

**Researched:** 2026-03-04  
**Phase:** 02-unattended-execution-reliability  
**Primary Requirements:** RELY-01, RELY-02, RELY-03, RELY-04, RELY-05

## Goal Alignment

Phase 2 must guarantee that once a run starts, the system drives itself toward a terminal outcome with bounded retries, recoverable interruption handling, and clear operational visibility.

- `RELY-01`: unattended operation requires deterministic run orchestration with no manual babysitting.
- `RELY-02`: stage-level progress must be emitted continuously enough for operational monitoring.
- `RELY-03`: transient failures must be retried automatically with strict boundaries.
- `RELY-04`: interruption recovery must resume from durable checkpoints.
- `RELY-05`: default behavior is completion-seeking execution unless hard-fail criteria are met.

Success for this phase is a reliability control layer that wraps existing execution stages without changing Phase 1 intake semantics.

## Scope and Boundaries

In-scope for Phase 2:
- Introduce a run state machine and transition guards.
- Add bounded retry orchestration for transient and rate-limit permission classes.
- Add checkpoint persistence, conflict detection, and resume behavior.
- Add stage-level progress events and final run summary shape.
- Define hard-fail versus retryable classification at run orchestration level.

Out-of-scope for Phase 2:
- New research-analysis capabilities (ANLY/EVID/REPT requirements).
- Multi-host reliability variants.
- External notification channel integrations (email/chat/webhook).

## Reliability Architecture

Recommended control plane components:
- `run-controller`: owns lifecycle, transitions, and termination decisions.
- `retry-policy`: classifies failures, computes backoff+jitter delays, tracks attempt budget.
- `checkpoint-store`: persists stage checkpoints, stale marking, retention enforcement.
- `resume-engine`: validates checkpoint compatibility and resumes latest incomplete run.
- `progress-reporter`: emits stage and transition events and composes final summary artifact.

Execution model:
1. Resolve start mode (`new` or `resume-latest`).
2. Enter `queued -> running`.
3. For each stage, execute with retry wrapper.
4. Persist checkpoint after each stage transition and on terminal failures.
5. Continue until terminal state (`completed`, `failed`, `cancelled`).

## Run State Machine

Required states from context:
- Non-terminal: `queued`, `running`, `retrying`, `paused`
- Terminal: `completed`, `failed`, `cancelled`

Guard rails:
- `completed` only when artifacts complete and critical validation passes.
- Retry exhaustion forces terminal `failed` with cause class (`transient_exhausted`, `hard_failure`, `dependency_blocked`).
- `cancelled` can only be set from non-terminal states.
- `paused` is checkpoint-safe, never a terminal success.

## Retry and Failure Policy

Recommended v1 policy:
- Retryable classes: transient network/server failures + rate-limit (`429`, rate-limit `403`).
- Non-retryable classes: auth denial, invalid input, deterministic dependency contract violations.
- Attempt budget: `maxAttempts=3` per stage operation.
- Delay strategy: exponential backoff with jitter and cap.
- On exhaustion: persist failure context, finalize run `failed`, emit high-priority summary entry.

Classification contract:
- `retryable: boolean`
- `failure_class: transient | permission_rate_limit | hard_failure | dependency_blocked`
- `terminal_reason: transient_exhausted | hard_failure | cancelled | completed`

## Checkpoint and Resume Model

Checkpoint schema (minimum):
- `run_id`, `stage`, `state`, `input_fingerprint`, `progress_snapshot`, `error_context`, `timestamp`.

Rules:
- Resume granularity is stage-level.
- Resume target is latest incomplete run.
- Input mismatch (`input_fingerprint`) rejects resume and starts new run.
- Checkpoint key format: `run_id + stage + timestamp`.
- Keep latest 5 checkpoints per run.
- Completed-run checkpoints are TTL-cleaned.
- Conflicting writes mark previous checkpoint `stale` and preserve audit trail.

## Progress Visibility and Reporting

Operational signal design:
- Emit updates every 10-30 seconds or on state transition.
- Log at stage-level and key events, not noisy per-line tracing.
- Final summary includes:
  - terminal conclusion
  - ordered state-transition trace
  - retry statistics by stage
  - failure taxonomy and root cause

Priority rule:
- Retry-exhausted and terminal failures are pinned to the top of final summary output.

## Standard Stack

Use existing project-aligned stack and avoid new infrastructure in Phase 2:
- TypeScript orchestration modules under `skills/github-researcher/lib/`.
- Existing retry primitive from `lib/intake/retry.ts` as the base adapter.
- Structured error contracts extending `lib/intake/error-codes.ts`.
- Filesystem-backed checkpoint artifact persistence compatible with current markdown/artifact workflow.
- Test stack: existing repo test runner and mocked integration tests.

## Architecture Patterns

Prescriptive patterns for this phase:
- Orchestrator pattern: one `run-controller` owns lifecycle decisions.
- Pure policy modules: retry decision and state transition guards remain side-effect-light and unit-testable.
- Append-only eventing: record state transitions as ordered immutable events.
- Checkpoint-after-stage pattern: checkpoint on stable boundaries to avoid partial-stage replay hazards.
- Fail-class layering: separate transport-level error from run-level terminal classification.

## Don't Hand-Roll

Do not build custom replacements for:
- Ad-hoc retry loops in each stage.
- Per-stage bespoke state enums.
- Implicit resume heuristics without deterministic input fingerprint checks.
- Free-form failure strings without stable error/failure codes.

Use shared reliability modules with explicit contracts instead.

## Common Pitfalls

- Over-broad retry policy can hide hard failures and waste run time.
- Missing checkpoint compatibility checks can resume with wrong input.
- Treating `paused` as success can violate RELY-05 completion semantics.
- Excessive log verbosity reduces overnight operational signal quality.
- Non-deterministic transition ordering breaks auditability and Nyquist validation.

## Code Examples

```ts
// Stage runner with bounded retry and transition-aware reporting.
async function executeStageWithReliability(ctx: RunContext, stage: Stage): Promise<void> {
  controller.transition(ctx, "running");

  const result = await retryPolicy.execute(async (attempt) => {
    reporter.emitAttempt(ctx, stage, attempt);
    return stageExecutor.run(ctx, stage);
  });

  if (!result.ok) {
    checkpointStore.saveFailureCheckpoint(ctx, stage, result.error);
    controller.fail(ctx, result.terminalReason);
    return;
  }

  checkpointStore.saveStageCheckpoint(ctx, stage, result.progress);
  reporter.emitStageCompleted(ctx, stage);
}
```

```ts
// Resume gate: deterministic rejection on input mismatch.
function resolveStartMode(input: RunInput): StartMode {
  const latest = checkpointStore.latestIncomplete(input.repoKey);
  if (!latest) return { type: "new" };

  if (latest.inputFingerprint !== fingerprint(input)) {
    return { type: "new", reason: "checkpoint_input_conflict" };
  }

  return { type: "resume", checkpoint: latest };
}
```

## Validation Architecture

Nyquist validation should prove completion-seeking behavior under realistic interruption and failure conditions.

Validation layers:
1. State machine unit tests
- valid and invalid transitions across all states
- terminal-state immutability checks
- `completed` guard requirements (artifact + validation)

2. Retry policy unit tests
- retryable versus non-retryable classification
- attempt budget enforcement (`maxAttempts=3`)
- backoff+jitter bounds and exhaustion behavior

3. Checkpoint/resume unit tests
- checkpoint payload completeness and serialization
- stale checkpoint marking on conflict
- input fingerprint mismatch forces new run

4. Orchestrator integration tests (mocked stages)
- uninterrupted run reaches `completed`
- transient faults recover and continue
- retry exhaustion reaches `failed` with correct terminal reason
- interruption followed by resume continues from stage boundary

5. Progress/reporting contract tests
- 10-30 second cadence or transition-based emission behavior
- high-priority failure pinning in final summary
- transition trace completeness and ordering

Requirement coverage mapping:
- `RELY-01`: validated by unattended end-to-end run tests requiring no manual intervention.
- `RELY-02`: validated by progress cadence and stage-event contract tests.
- `RELY-03`: validated by retry policy and transient recovery tests.
- `RELY-04`: validated by checkpoint schema, resume path, and conflict rejection tests.
- `RELY-05`: validated by completion-seeking orchestrator tests and hard-fail boundary assertions.

Exit criteria for Phase 2:
- all run states and transitions are test-validated
- retry boundary tests pass for transient, rate-limit, and hard-fail cases
- checkpoint resume/conflict paths pass
- completion-seeking behavior is demonstrated in integration scenarios

## Planning Implications

Recommended plan slices:
1. Define reliability domain contracts (run state, failure class, checkpoint schema, event model).
2. Implement run controller and transition guards.
3. Implement retry policy adapter using existing retry primitive.
4. Implement checkpoint store + resume engine with conflict handling.
5. Implement progress reporter and final run summary composition.
6. Add unit and integration tests mapped to RELY-01..RELY-05.
7. Wire reliability controller into current execution entrypoint.

Critical decisions to lock in planning:
- exact transition guard table and illegal-transition behavior
- jitter/backoff constants and max delay cap
- checkpoint TTL default and cleanup cadence
- which failures count as `dependency_blocked` versus `hard_failure`

## Risks and Mitigations

- Risk: retry policies that are too permissive can mask systemic failures.
- Mitigation: strict retryable-class whitelist and explicit exhaustion terminal reasons.

- Risk: checkpoint corruption or incompatible resume can cause silent drift.
- Mitigation: input fingerprint checks plus reject-and-restart behavior.

- Risk: progress noise can obscure actionable issues.
- Mitigation: stage-level structured events and pinned high-priority failure entries.

## Open Questions for Plan Phase

- What exact state transition matrix (allowed edges) should be encoded first for minimal complexity?
- Should checkpoint storage be file-per-checkpoint or batched per run for v1 reliability/perf tradeoff?
- What concrete TTL default best balances auditability and disk hygiene for overnight usage?

## Research Conclusion

Phase 2 should introduce a dedicated reliability orchestration layer with explicit state control, bounded retry, deterministic checkpoint resume, and high-signal progress reporting. This satisfies `RELY-01` through `RELY-05` while preserving compatibility with current intake and downstream analysis phases.
