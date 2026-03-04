# Phase 06 Research: Coverage Accounting and Large-Repo Phasing

**Phase:** 06-coverage-accounting-and-large-repo-phasing  
**Date:** 2026-03-04  
**Scope:** ANLY-04, ANLY-05 only

## Objective Restatement
Implement explicit, audit-ready coverage accounting for repository analysis and add phased execution for very large repositories, with deterministic merge into one coherent result.

Success is not just "scan more files." Success is:
- clear completeness boundaries (what was scanned, what was not, and why),
- interruption-safe phased execution for large repos,
- one merged output that stays conflict-transparent and traceable.

## What Must Be Known Before Planning

### 1. Coverage Accounting Contract (ANLY-04 Core)
You need a locked schema before coding. Planning should define:
- accounting granularity: module summary with file-level drill-down,
- required counters:
  - total candidate files in in-scope tree,
  - scanned files,
  - excluded-by-policy files,
  - unresolved/unparseable files,
  - deferred-to-future-phase files,
- gap taxonomy: grouped by `cause + impact` (not one-dimensional),
- quality tier output: `high|medium|low` coverage confidence,
- traceability fields: each accounting row references concrete repo path/module id and phase id.

Without this schema lock first, phased merge will drift and tests will be brittle.

### 2. Scope Baseline and Exclusion Policy
Phase 6 needs deterministic scope boundaries. Planning should freeze:
- default exclusion patterns (build artifacts, vendor deps, generated caches),
- normalization of path rules across GitHub and local input modes,
- policy for unresolved files: always recorded as known gaps, never silently dropped.

This is the main trust boundary for ANLY-04.

### 3. Large-Repo Trigger and Partitioning Rules (ANLY-05 Core)
Planning must define when phased mode is activated and how phase buckets are built:
- activation heuristics (example: file count/module count/estimated token budget threshold),
- partition strategy: module-boundary first, core-first ordering preserved from Phase 5,
- adaptive sub-phase sizing rule (targeted work unit size, max phase count cap),
- handling long-tail/straggler modules (defer or fold into final phase with explicit reason).

If these rules are not explicit, resume and merge behavior becomes non-deterministic.

### 4. Per-Sub-Phase Lifecycle Semantics
Each sub-phase should have a stable lifecycle contract:
- metadata: `phase_id`, `scope`, `status`, `conclusions`, `gaps`, `started_at`, `ended_at`,
- completion artifacts:
  - phase-local coverage summary,
  - phase-local findings/conclusions,
  - evidence index references (IDs only in Phase 6; full citation policy is Phase 7),
- failure behavior: hard-fail sub-phase becomes explicit gap and run continues when safe.

This is required to meet unattended reliability carry-forward constraints from Phase 2.

### 5. Merge and Conflict Adjudication Policy
Planning must lock merge rules before implementation:
- dedupe keying for repeated findings across phases,
- stale/superseded evidence handling (retain with status, do not delete),
- conflict representation (keep prior conflicting conclusion history),
- final adjudication output with rationale and merged confidence tier (`high|medium|low`),
- final output structure: unified main report + appendices per phase.

This is the ANLY-05 "one coherent output" boundary.

### 6. Resume/Checkpoint Model Extension
Existing reliability checkpoints are stage-based. Phase 6 planning must define how to extend them:
- persist last successful sub-phase id and queue of remaining scopes,
- persist per-phase coverage manifest snapshot for resume-safe merge,
- ensure restart does not recompute completed sub-phases unless forced,
- preserve deterministic terminal classification from current reliability framework.

### 7. Phase Boundary Guardrails
Planning must keep scope strict:
- do not implement citation URL/line anchor guarantees here (Phase 7),
- do not implement final narrative report rendering policy here (Phase 8),
- do produce machine-readable artifacts those later phases can consume.

## Existing Implementation Surfaces to Reuse

From current codebase:
- `skills/github-researcher/lib/analysis/core/artifacts.ts`
  - core snapshot lifecycle already exists and can seed Phase 6 baseline manifests.
- `skills/github-researcher/lib/analysis/core/core-first-sequencer.ts`
  - preserves core-first transition semantics needed before phased broad coverage.
- `skills/github-researcher/lib/reliability/orchestrator.ts`
  - checkpoint/resume lifecycle; extend snapshots with sub-phase state, do not replace orchestrator.
- `skills/github-researcher/lib/reliability/progress-reporter.ts`
  - emit phased milestones using existing transition/terminal event model.

## Recommended Architecture for Phase 6

### Option A: Manifest-First Phased Pipeline (Recommended)
Approach:
- Introduce a deterministic coverage manifest as first-class artifact.
- Build phased execution plan from manifest partitions.
- Execute sub-phases with checkpointed results.
- Merge phase outputs via explicit reducer rules.

Why best now:
- aligns with existing deterministic/testing style,
- integrates cleanly with current reliability state model,
- creates reusable machine-readable boundary for Phases 7 and 8.

Tradeoffs:
- requires upfront schema design discipline,
- may add temporary boilerplate before report synthesis phase.

### Option B: Ad-Hoc Runtime Partition + Late Summary
Approach:
- split work dynamically during scanning and summarize late.

Why not recommended:
- weaker reproducibility,
- harder to audit exact scope boundaries,
- conflict resolution becomes implicit and brittle.

## Proposed Data Contracts (Planning-Level)

Define contracts before any orchestration wiring:
- `CoverageManifest`
  - global scope inventory and exclusion decisions.
- `CoverageGap`
  - `cause`, `impact`, `module_id`, `path`, `reason`, `phase_id`.
- `PhaseScopeChunk`
  - deterministic module/file subset with ordering index.
- `PhaseExecutionRecord`
  - status, outputs, conclusions, gaps, coverage summary.
- `MergedCoverageSummary`
  - global + per-phase accounting statements.
- `MergedConclusionRecord`
  - dedupe key, conflict history, adjudication rationale, confidence tier.

Keep all fields deterministic and serialization-stable.

## Plan-Slicing Guidance

### Slice 1: Contracts and Invariants
Deliver:
- coverage/phase/merge type definitions,
- invariants for traceability, ordering, and gap recording.

Exit checks:
- contracts compile,
- manifest serialization round-trip tests pass,
- unresolved file must produce explicit gap record.

### Slice 2: Coverage Manifest Builder
Deliver:
- scope inventory + exclusion + gap classifier,
- module+file aggregation utilities.

Exit checks:
- scanned/excluded/unresolved counters reconcile,
- path normalization deterministic across fixtures.

### Slice 3: Large-Repo Phase Planner
Deliver:
- phase activation heuristics,
- module-boundary partitioner with core-first ordering,
- adaptive sizing algorithm.

Exit checks:
- same input => same partitions/order,
- small repos remain single-phase path.

### Slice 4: Sub-Phase Execution + Resume Integration
Deliver:
- orchestration glue for sub-phase loop,
- checkpoint payload extension with phase progress,
- continue-on-safe-failure behavior with gap capture.

Exit checks:
- interrupted run resumes at next pending sub-phase,
- completed sub-phases are not replayed.

### Slice 5: Merge + Conflict Adjudication
Deliver:
- dedupe reducer,
- conflict history preservation,
- merged confidence computation and dual coverage statements.

Exit checks:
- duplicate findings merged deterministically,
- conflicting findings remain visible with explicit adjudication rationale.

### Slice 6: Validation and Guardrails
Deliver:
- ANLY-04/05 integration tests,
- regression tests on core-first + reliability compatibility,
- scope-guard tests blocking Phase 7/8 leakage.

Exit checks:
- required success criteria proven by automated tests,
- no citation-link/report-renderer coupling introduced.

## Test Strategy You Should Plan Upfront

Minimum matrix:
- unit:
  - manifest counting and exclusion logic,
  - partition determinism,
  - merge dedupe/conflict behavior.
- integration:
  - phased run happy path (multi-phase -> merged output),
  - sub-phase hard-fail converted to known gap with continuation,
  - resume from interrupted mid-phase queue,
  - core-first continuity from Phase 5 artifacts.
- regression:
  - non-large repo still behaves as single coherent run,
  - reliability progress and terminal states unchanged.

## Key Risks and Mitigations

1. Risk: Coverage numbers look complete but hide unresolved files.  
Mitigation: invariant requiring unresolved files to map to explicit gap entries.

2. Risk: Phase splitting changes run-to-run.  
Mitigation: deterministic ordering keys and fixed heuristic thresholds.

3. Risk: Merge silently overwrites conflicting conclusions.  
Mitigation: preserve conflict history + adjudication record; never hard-overwrite.

4. Risk: Resume replays expensive completed sub-phases.  
Mitigation: checkpoint phase queue and completed-phase IDs explicitly.

5. Risk: Scope creep into citation/report formatting.  
Mitigation: contract-only evidence IDs and machine-readable merge outputs in Phase 6.

## Open Questions to Resolve Early
- Exact threshold values for `high|medium|low` coverage confidence tiers.
- Exact large-repo activation cutoffs (file/module/token estimates).
- Specific safe-continue criteria after sub-phase hard failure.
- Confidence aggregation formula for merged conclusions.
- Canonical fixture repos for phased-scale integration testing.

## Planning Recommendation
Plan Phase 6 around **manifest-first phased orchestration (Option A)** with explicit contracts first, then partitioning/resume behavior, then merge/conflict logic, then validation.

This sequence best satisfies ANLY-04 and ANLY-05 while preserving Phase 2/5 guarantees and keeping Phase 7/8 responsibilities cleanly separated.
