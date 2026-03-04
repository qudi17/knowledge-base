# Phase 05 Research: Core Architecture and Workflow Analysis

**Phase:** 05-core-architecture-and-workflow-analysis  
**Date:** 2026-03-04  
**Scope:** ANLY-01, ANLY-02, ANLY-03 only

## Objective Restatement
Implement a deterministic, core-first analysis engine that:
- identifies core modules and explains their roles (ANLY-01),
- reconstructs cross-module end-to-end workflows (ANLY-02),
- enforces core-first sequencing before broader expansion (ANLY-03).

This phase must not implement citation guarantees (Phase 7) or report formatting/synthesis (Phase 8).

## What Must Be Known Before Planning

### 1. Core Unit Definition
- Confirm module boundary abstraction used by the analyzer (directory/package + responsibility aggregation as default).
- Confirm how aliases are merged when naming differs but responsibility overlaps.
- Confirm minimum evidence classes required for module inclusion (>=2 classes per context).

### 2. Evidence Model for Core Scoring
- Define evidence classes available at runtime (e.g., dependency graph, entrypoint reachability, change activity).
- Define normalized scoring function with locked weights:
  - critical-path impact: 50%
  - change activity: 30%
  - dependency centrality: 20%
- Define tie-break and manual-promotion mechanics, including mandatory rationale fields.

### 3. Workflow Reconstruction Contract
- Define workflow graph schema at module-level granularity with optional key function nodes.
- Define mainline extraction strategy and exception-node inclusion rules.
- Define minimum workflow acceptance gates:
  - crosses >=2 modules,
  - covers one key chain end-to-end,
  - at least one workflow required (target two when feasible).

### 4. Core-First Stage Control
- Define explicit stage boundaries:
  - entry module discovery,
  - core business module scoring/selection,
  - supporting module context expansion.
- Define hard phase-exit criteria for core-first:
  - core set complete,
  - role explanations complete,
  - >=1 cross-module workflow reconstructed,
  - core snapshot artifact frozen.
- Define interruption-resume checkpoint semantics aligned with existing reliability orchestrator.

### 5. Determinism Expectations
- Define reproducibility tolerance and test oracle:
  - reruns should produce >=80% overlap on top-5 core modules.
- Define ordering guarantees (sorted by core score desc).
- Define deterministic defaults for unbounded candidate pool handling.

## Implementation Options

### Option A: Rule-Weighted Heuristic Pipeline (Recommended)
Approach:
- Build a staged analysis pipeline with explicit, deterministic rules and weighted scoring.
- Use static repository signals + lightweight traversal to compute core candidates.
- Reconstruct workflows from entrypoint-forward traversal constrained by core set.

Why this is best for Phase 05:
- Matches existing deterministic/auditable direction in context.
- Integrates cleanly with current reliability/checkpoint infrastructure.
- Minimizes scope creep into later evidence/report phases.

Tradeoffs:
- May miss nuanced semantic workflows in highly dynamic codebases.
- Requires careful rule tuning per language mix.

### Option B: LLM-Heavy Semantic Inference First
Approach:
- Use model-driven summarization to infer modules and workflows before rules.

Why not first choice for Phase 05:
- Lower determinism and weaker replayability for unattended operation.
- Harder to guarantee overlap/stability targets without heavy guardrails.
- Increases risk of leaking into citation/report-quality concerns prematurely.

### Option C: Full Program Analysis Engine
Approach:
- Build language-aware call graph and data-flow precision upfront.

Why not first choice for Phase 05:
- High implementation cost and phase spill risk.
- Better phased in later if ANLY-04/05 needs deeper completeness for large repos.

## Recommended Architecture for This Phase

## Standard Stack
- Reuse `skills/github-researcher/lib/reliability/orchestrator.ts` for stage lifecycle/checkpoints.
- Reuse `skills/github-researcher/lib/reliability/progress-reporter.ts` for stage-level progress.
- Add new analysis modules under `skills/github-researcher/lib/analysis/core/*`:
  - `module-boundary.ts`
  - `core-scoring.ts`
  - `workflow-reconstruction.ts`
  - `core-first-sequencer.ts`
  - `artifacts.ts`

## Architecture Patterns
- Pure-function scoring + explicit input/output contracts for deterministic behavior.
- Pipeline stages with immutable intermediate artifacts.
- Checkpoint-at-stage-boundary pattern to preserve resume correctness.
- Conflict-triggered revalidation loop when later evidence contradicts frozen core conclusions.

## Don't Hand-Roll
- Do not create a custom reliability framework; use existing orchestrator/progress components.
- Do not build a generalized visualization/report layer in this phase.
- Do not implement citation-link generation in this phase.

## Common Pitfalls
- Core selection drifting due to non-deterministic candidate iteration.
- Workflow extraction collapsing into single-module traces.
- Including tests/examples/scripts as core without direct invocation evidence.
- Failing to freeze core snapshot before broad expansion.
- Silent manual promotions without rationale trace fields.

## Integration Points
- **Input side:** consumes normalized repository target from existing intake/preflight pipeline.
- **Runtime side:** plugs in after reliability init; emits progress via current reporter.
- **Artifact side:** outputs machine-readable core/workflow artifacts for later Phase 6 coverage accounting.
- **Upstream-to-later phases:** core snapshot becomes source context for Phase 7 and Phase 8 (without implementing those concerns here).

## Key Risks and Mitigations

1. Risk: Inconsistent core module ranking across reruns.
- Mitigation: lock sort/order semantics, deterministic tie-breakers, stable traversal order tests.

2. Risk: Workflow reconstruction quality too shallow for real decision utility.
- Mitigation: enforce acceptance gates (>=2 modules, key mainline, key retry/error nodes only).

3. Risk: Core-first budget (60-70%) not respected under large repos.
- Mitigation: budget-aware stage timers and explicit checkpoint exits.

4. Risk: Multi-language repositories cause fragmented module boundaries.
- Mitigation: language-agnostic boundary interface + per-language adapters under same contract.

5. Risk: Scope leak into evidence/report formatting.
- Mitigation: phase guard tests that assert no citation/report renderer dependencies introduced.

## Plan-Slicing Guidance

### Slice 1: Contracts and Artifacts
Deliverables:
- Type contracts for module candidates, score evidence, workflows, core snapshot.
- Artifact schema for frozen core conclusions.

Exit checks:
- Contracts compile and are serialization-stable.
- Artifact schema includes rationale and stability markers.

### Slice 2: Core Candidate Extraction + Scoring
Deliverables:
- Candidate extraction, evidence collection, weighted scorer, deterministic ranking.

Exit checks:
- Top-5 overlap regression test harness for rerun stability.
- Exclusion/default rules enforced (tests/examples/scripts).

### Slice 3: Role Explanation Generation
Deliverables:
- Deterministic role explanation generation from evidence bundle.

Exit checks:
- Each selected module has role explanation + entrypoints + evidence-class count.

### Slice 4: Workflow Reconstruction
Deliverables:
- Module-level workflow builder with optional key function nodes.
- Mainline-first with bounded exception branch inclusion.

Exit checks:
- At least one accepted cross-module workflow produced on representative fixture.

### Slice 5: Core-First Sequencer + Checkpoint Integration
Deliverables:
- Stage orchestration and resume semantics integrated with reliability framework.
- Core snapshot freeze/unfreeze + conflict revalidation flow.

Exit checks:
- Interrupted run can resume from last core-first checkpoint.
- Snapshot artifact created before broad-scan transition.

### Slice 6: Guardrails and Validation
Deliverables:
- Scope guard tests to prevent Phase 7/8 coupling.
- Invariants and smoke tests over end-to-end phase behavior.

Exit checks:
- ANLY-01/02/03 acceptance tests passing.
- No evidence/report formatting dependencies added.

## Open Questions to Resolve Early
- What exact evidence classes are mandatory vs optional per language family?
- Which repositories will be canonical fixtures for stability/workflow quality tests?
- What threshold policy triggers automatic core revalidation on conflicting later evidence?

## Confidence
- Core-first deterministic pipeline feasibility: **High**
- Cross-language boundary normalization detail maturity: **Medium**
- Workflow extraction robustness across dynamic frameworks: **Medium**

## Recommendation
Plan Phase 05 around **Option A (rule-weighted heuristic pipeline)** with explicit contracts first, then scoring/workflow logic, then sequencer integration. This yields highest confidence delivery of ANLY-01/02/03 while preserving phase boundaries and enabling Phase 6/7/8 downstream work.
