# Phase 7: Evidence and Citation Guarantees - Context

**Gathered:** 2026-03-04
**Status:** Ready for planning

<domain>
## Phase Boundary

This phase enforces auditable evidence guarantees for key conclusions: snippet-backed citations, GitHub line-anchored links, and reproducible dual-link references (SHA-pinned + default-branch).

This phase does not redesign final report narrative/visual synthesis (Phase 8) and does not add new analysis capabilities beyond evidence hardening.

</domain>

<decisions>
## Implementation Decisions

### Citation Link Contract
- Each key conclusion uses dual-link output: **SHA-pinned link first**, then default-branch link.
- Link normalization is mandatory (canonical owner/repo/path formatting).
- Line anchoring defaults to function-level anchors; when unavailable, fallback order is fixed:
  1. line anchor
  2. function signature match
  3. nearest in-file location
- Citation deduplication is conclusion-level with source retention.
- Evidence IDs use a stable hash-based scheme for cross-run alignment.

### Snippet Selection Policy
- Default snippet strategy: function primary snippet plus key branch snippets.
- Minimum baseline: at least **1 snippet + 1 citation link** per key conclusion.
- For error/retry conclusions, exception-path snippet is mandatory.
- Long functions are shown as segmented snippets with explicit omission markers.
- Snippets are ordered by mainline first, then branch/exception evidence.
- Snippet labels use semantic names (not only file/function labels).
- Snippet sanitation is minimal and semantics-preserving.
- Multi-language repositories follow a unified evidence structure template.

### Evidence Strength and Confidence
- Confidence is rule-mapped (not purely model-subjective) from evidence quantity/diversity/consistency.
- High-risk conclusions use stricter evidence thresholds.
- Evidence conflicts are preserved explicitly and confidence is downgraded with adjudication rationale.

### Stale-Link Detection and Revalidation
- Stale-link detection runs immediately after evidence generation.
- Revalidation defaults to impacted conclusions only.
- If revalidation still fails, stale evidence is retained with explicit stale status (no silent deletion).
- Stale alerts are impact-tiered.
- Revalidation has bounded budget; overflow is logged as unresolved revalidation backlog.
- Evidence freeze occurs only after revalidation completes.
- Evidence changes are published in a dedicated changelog section (add/replace/stale + reasons).

### Carry-Forward from Prior Phases
- Preserve Phase 6 coverage and phase lineage fields as upstream provenance for evidence records.
- Preserve deterministic ordering and checkpoint-safe unattended behavior from prior phases.
- Maintain research-only scope; no repository mutation actions.

### Claude's Discretion
- Exact confidence scoring formula and threshold constants.
- Exact hash seed/format for stable evidence ID generation.
- Exact stale-link retry cadence and per-run budget defaults.

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `skills/github-researcher/lib/analysis/index.ts`: runtime output surface where evidence bundles can be attached to conclusions.
- `skills/github-researcher/lib/analysis/coverage/merge-coherence.ts`: already stores conflict lineage and evidence IDs, can be extended into citation-level provenance.
- `skills/github-researcher/lib/analysis/coverage/types.ts`: existing typed records are suitable anchors for evidence/citation contracts.
- `skills/github-researcher/lib/reliability/orchestrator.ts`: can persist citation validation/revalidation checkpoints.
- `skills/github-researcher/lib/reliability/progress-reporter.ts`: can emit evidence-validation milestones.

### Established Patterns
- Deterministic sorting, explicit reason codes, and resumable checkpoint state are now project-wide patterns.
- Tests favor contract-focused and integration-focused Vitest coverage with stable fixtures.

### Integration Points
- Phase 7 should inject citation guarantees into analysis output path without changing intake/search/local input contracts.
- Evidence validation outcomes should feed into reliability progress + checkpoint snapshots for unattended runs.
- Phase 8 report synthesis must consume Phase 7 evidence artifacts directly (no re-derivation).

</code_context>

<specifics>
## Specific Ideas

- Prioritize auditability: evidence records should be readable by humans and machine-joinable by stable IDs.
- Keep report readability while preserving reproducibility by always presenting SHA link first and latest link second.
- Treat stale evidence as first-class tracked state, not hidden cleanup.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within Phase 7 boundary.

</deferred>

---
*Phase: 07-evidence-and-citation-guarantees*
*Context gathered: 2026-03-04*
