# Phase 5: Core Architecture and Workflow Analysis - Context

**Gathered:** 2026-03-04
**Status:** Ready for planning

<domain>
## Phase Boundary

This phase delivers deep core understanding first: identify core modules, explain their roles, and reconstruct at least one end-to-end workflow across modules before broad-scope expansion.

This phase does not finalize evidence citation guarantees (Phase 7) or report synthesis format/presentation (Phase 8).

</domain>

<decisions>
## Implementation Decisions

### Core Module Identification Rules
- Primary core scoring axis is business critical-path impact.
- Default core module count target is around 5 modules.
- Module boundary defaults to directory/package boundary plus responsibility aggregation.
- First-pass output shape must include: module list + module responsibilities + entry points.
- Core confidence threshold is required: default `>= 0.7`.
- Cross-layer infra modules are included only when they are key dependencies on main flow.
- Entry points should prioritize public APIs and main-flow call entrypoints.
- Tie-breaking favors modules with higher main-flow coverage.
- Core scoring uses weighted signals: critical-path impact 50%, change activity 30%, dependency centrality 20%.
- Core set must cover at least 80% of one key workflow chain.
- Test/example/script directories are excluded by default unless directly invoked in core flow.
- Core module list is sorted by core score descending.
- Candidate pool is unbounded when needed (no hard cap), but output remains core-focused.
- Manual promotion of low-frequency but high-impact modules is allowed and must include explicit rationale.
- Core output should include stability marker per module (`stable` / `evolving`).
- Multi-language repositories may have core modules across languages.
- Repeated runs on same repo target should aim for >=80% overlap on top-5 core modules.
- Module alias merging is allowed when same responsibility appears under different naming; mapping must be recorded.
- Minimum evidence for core inclusion is at least two evidence classes.
- When evidence conflicts strongly, trigger core set revalidation before continuing.

### End-to-End Workflow Reconstruction
- Default workflow granularity: module-level main chain with key function nodes.
- Per repository, produce at least 1 core workflow; target 2 when feasible.
- Workflow must cross at least 2 modules.
- Mainline is mandatory; exception branches include only key error/retry nodes.

### Core-First Analysis Sequencing
- Default order: entry modules -> core business modules -> supporting modules.
- Core-first phase exits when core module set + at least one cross-module E2E workflow are complete.
- Core-first budget target is 60% of total analysis time; may extend to 70% with explicit reason logging.
- On interruption, resume from last completed core-first checkpoint step.
- Before broad scan, freeze a core conclusion snapshot artifact.
- If core conclusions conflict with later evidence, revalidate and update core set using recorded rationale.

### Scope Guardrails
- Phase 5 focuses on module understanding and workflow reconstruction only.
- Citation enforcement details are deferred to Phase 7.
- Final report formatting/synthesis decisions are deferred to Phase 8.

### Claude's Discretion
- Exact quantitative scoring formula normalization across repositories.
- Exact workflow extraction algorithm details under the locked granularity/coverage constraints.
- Exact snapshot artifact file schema while preserving required content fields.

</decisions>

<specifics>
## Specific Ideas

- Keep outputs auditable for overnight unattended runs: prioritize stable, replayable decision trails over ad-hoc exploration notes.
- Optimize for decision utility: core-first should quickly answer “how this project fundamentally works” before broad traversal.
- Preserve deterministic behavior: same repo + same settings should yield highly similar core module outputs across reruns.

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `skills/github-researcher/lib/intake/*`: normalized multi-mode target intake already established (URL/search/local).
- `skills/github-researcher/lib/reliability/orchestrator.ts`: run lifecycle, checkpoint/resume, and progress model can host core-first stage sequencing.
- `skills/github-researcher/lib/reliability/progress-reporter.ts`: suitable for core-first stage visibility and snapshot transitions.
- `skills/github-researcher/lib/search/*`: existing selection context pattern useful for carrying analysis context metadata.

### Established Patterns
- Structured success/failure contracts and deterministic normalization are now consistent across input modes.
- Reliability path already supports checkpoint-based resume and deterministic terminal states.
- Planning/execution artifacts favor auditable markdown summaries with explicit self-check markers.

### Integration Points
- New analysis engine should plug in after preflight/reliability initialization without changing intake contracts.
- Core module scoring and workflow reconstruction outputs should emit machine-readable artifacts for later coverage accounting (Phase 6).
- Core snapshot artifact from this phase should feed citation/report phases as upstream source-of-truth context.

</code_context>

<deferred>
## Deferred Ideas

- Citation format guarantees and line-anchored evidence policy (Phase 7).
- Final report template, diagram rendering style, and recommendation framing (Phase 8).
- Full-repo completeness accounting and phased merge policy (Phase 6).

</deferred>

---
*Phase: 05-core-architecture-and-workflow-analysis*
*Context gathered: 2026-03-04*
