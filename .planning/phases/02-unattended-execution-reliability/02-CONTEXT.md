# Phase 2: Unattended Execution Reliability - Context

**Gathered:** 2026-03-04
**Status:** Ready for planning

<domain>
## Phase Boundary

This phase delivers reliability controls for unattended execution: run state machine, retry boundaries, checkpoint-based recovery, and observable progress behavior so a single trigger can run to a completion-oriented terminal state without manual babysitting.

This phase does not add new research-analysis capabilities; it defines reliability and operational behavior around existing execution flow.

</domain>

<decisions>
## Implementation Decisions

### Run State Machine
- v1 state set: `queued`, `running`, `retrying`, `paused`, `failed`, `completed`, `cancelled`.
- Terminal states are only `completed`, `failed`, `cancelled`.
- `completed` requires: artifacts complete + critical validation passed + run state finalized.
- `failed` must be layered with clear cause class (for example: `transient_exhausted`, `hard_failure`, `dependency_blocked`).

### Retry Boundaries
- Auto-retry scope: transient failures + limited permission class.
- Permission retries are allowed only for rate-limit semantics (`429` and rate-limit `403`), not generic auth/permission denials.
- Default max attempts per step: 3.
- Backoff policy: exponential backoff with jitter.
- On retry exhaustion: mark run `failed` and persist recovery-ready context.

### Checkpoint and Resume Model
- Resume granularity is stage-level for v1.
- Minimum checkpoint payload: state + input + progress + error context.
- Resume trigger: automatically attempt to resume the latest incomplete run.
- On checkpoint/input conflict: reject resume and start a new run.
- Checkpoint naming: `run_id + stage + timestamp`.
- Retention: keep latest 5 checkpoints per run.
- Cleanup: TTL-based automatic cleanup for completed runs.
- On conflict, previous checkpoint is marked `stale` and preserved.

### Progress Visibility and Alerts
- Runtime logs: stage-level plus key events (not noisy per-line tracing by default).
- Update cadence: every 10-30 seconds or on state transitions.
- Final run summary format: conclusion + state-transition trace + retry/failure statistics.
- Failure/retry-exhausted events: emit high-priority events and pin them at top of final summary.

### Claude's Discretion
- Exact state transition guard implementation details.
- Exact jitter function and retry delay constants under the chosen policy.
- Exact TTL default value and cleanup scheduler cadence.

</decisions>

<specifics>
## Specific Ideas

- Reliability design should optimize for overnight unattended runs with morning-read clarity.
- Recovery should be safe-by-default: no risky forced resume on mismatched input.
- Visibility should prioritize actionable operational signals over verbose logs.

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `skills/github-researcher/lib/intake/preflight.ts`: existing deterministic pipeline can be wrapped with run-state and checkpoint orchestration.
- `skills/github-researcher/lib/intake/error-codes.ts`: existing failure taxonomy foundation can be extended into phase-level failure layering.
- `skills/github-researcher/lib/intake/retry.ts`: existing bounded retry primitive can be reused for reliability orchestration.

### Established Patterns
- Phase 1 already uses structured success/failure contracts; Phase 2 should preserve this contract style.
- Project planning artifacts favor auditable markdown outputs and explicit state transitions.

### Integration Points
- Run-state and checkpoint storage should integrate upstream of analysis execution entrypoint.
- Final summary metadata should feed reporting workflow and later verification phases.

</code_context>

<deferred>
## Deferred Ideas

- Notification delivery integrations (email/chat/webhook) are deferred unless required by current phase scope.
- Multi-host reliability differences are deferred with multi-host support itself.

</deferred>

---
*Phase: 02-unattended-execution-reliability*
*Context gathered: 2026-03-04*
