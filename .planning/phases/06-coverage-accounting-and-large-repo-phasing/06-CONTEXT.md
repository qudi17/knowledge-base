# Phase 6: Coverage Accounting and Large-Repo Phasing - Context

**Gathered:** 2026-03-04
**Status:** Ready for planning

<domain>
## Phase Boundary

This phase delivers explicit analysis coverage accounting and phased execution for very large repositories, then merges phased outputs into one coherent, audit-ready result.

This phase does not add new evidence-citation guarantees (Phase 7) or final report synthesis/presentation policy (Phase 8).

</domain>

<decisions>
## Implementation Decisions

### Coverage Accounting Model
- Primary coverage accounting unit is **module + file**: report starts at module aggregation with file-level drill-down.
- Coverage summary must include both **scanned scope** and **known gaps**.
- Known gaps are grouped by **cause + impact level** (not cause-only or impact-only).
- Coverage quality is expressed with **High/Medium/Low** rating tiers (not binary pass/fail).
- Coverage output format is **summary first + detailed tables**.
- Default coverage scope excludes common noise directories/artifacts (for example: build outputs and vendored dependencies).
- Unresolved/unparseable files are not silently dropped; they are recorded as known gaps with explicit reason and impact.
- Coverage traceability requirement: every module/file accounting entry should be traceable back to concrete source location.

### Large-Repo Phased Execution
- Phase split baseline is **module-boundary partitioning**.
- Execution order remains **core-first then expansion** to preserve decision utility from Phase 5.
- Each sub-phase completion requires both:
  - coverage accounting output for that phase scope
  - readable phase conclusions for that scope
- Resume policy for interruption is **continue from last successful sub-phase** (no full restart by default).
- Number of sub-phases is **adaptive to repository scale**.
- Per-sub-phase metadata must include **scope + status + conclusions + gaps**.
- If a sub-phase hard-fails, workflow should **record the gap and continue** when safe, instead of aborting the entire run by default.
- Runtime is allowed limited stage reordering when newly discovered core areas appear, with explicit reorder logs.

### Cross-Phase Merge and Consistency
- Final output should be **one unified main report + phase appendices**.
- Merge must deduplicate repeated findings while preserving multi-phase evidence chains.
- If conclusions conflict across phases, report must preserve conflict history and provide explicit final adjudication rationale.
- Every merged key conclusion should include confidence as **High/Medium/Low** from evidence-weighted aggregation.
- Main report should use global + per-phase dual coverage statements.
- Appendix structure is **by phase id/sequence**, each section including scope, conclusions, gaps, and evidence index.
- Evidence traceability should use a stable **evidence ID** scheme shared between main report and appendices.
- Superseded/stale evidence is retained with explicit stale/superseded status and replacement rationale (not hard-deleted).

### Carry-Forward Constraints from Prior Phases
- Preserve Phase 5 core-first semantics and core snapshot continuity as upstream truth source.
- Preserve Phase 2 unattended reliability principles: checkpoint resume, deterministic terminal states, stage-level progress visibility.
- Keep v1 scope as research-only and avoid introducing out-of-phase capabilities.

### Claude's Discretion
- Exact H/M/L threshold boundaries and calibration policy.
- Exact adaptive phase-sizing heuristics for very large repositories.
- Exact evidence-weighted confidence computation details under the locked output semantics.

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `skills/github-researcher/lib/analysis/core/artifacts.ts`: core snapshot lifecycle helpers can seed phase-level coverage manifests.
- `skills/github-researcher/lib/analysis/core/core-first-sequencer.ts`: existing core-first gates and progression order provide phased execution baseline.
- `skills/github-researcher/lib/reliability/orchestrator.ts`: checkpoint/resume and stage progression model can host phase-level coverage checkpoints.
- `skills/github-researcher/lib/reliability/progress-reporter.ts`: stage progress event model can emit per-phase accounting and merge milestones.

### Established Patterns
- Structured contracts and deterministic ordering are already used in intake/reliability/analysis modules.
- Resume-safe behavior is stage checkpoint based; phase-level orchestration should extend this model rather than replace it.
- Test style is Vitest unit/integration with deterministic assertions and explicit failure semantics.

### Integration Points
- Phase 6 modules should consume Phase 5 core artifacts as baseline and append explicit full-scope accounting.
- Coverage accounting outputs should become machine-readable inputs for later citation guarantees (Phase 7) and report synthesis (Phase 8).
- Merge artifacts must remain compatible with existing reliability context so unattended reruns preserve continuity.

</code_context>

<specifics>
## Specific Ideas

- Keep nightly unattended usability: sub-phase hard failures should be visible and bounded, but should not collapse entire run by default.
- Coverage accounting should be decision-readable first (summary), but fully auditable when drilling down (tables + trace links/paths).
- Merged output should remain conflict-transparent rather than silently flattening contradictory results.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within Phase 6 scope.

</deferred>

---
*Phase: 06-coverage-accounting-and-large-repo-phasing*
*Context gathered: 2026-03-04*
