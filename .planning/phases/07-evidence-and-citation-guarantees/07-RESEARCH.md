# Phase 07 Research: Evidence and Citation Guarantees

**Phase:** 07-evidence-and-citation-guarantees  
**Date:** 2026-03-04  
**Scope:** EVID-01, EVID-02, EVID-03, EVID-04 only

## Objective Restatement
Phase 07 must make every key conclusion auditable with reproducible evidence artifacts.

Success means:
- every conclusion has at least one citation (EVID-01),
- citations resolve to GitHub line anchors (EVID-02),
- function/method-level snippets are attached to key findings (EVID-03),
- SHA-pinned and default-branch links are both emitted when available (EVID-04).

This phase should harden evidence contracts and validation pipelines, not redesign final report narrative (Phase 8).

## What Must Be Known Before Planning

### 1. Contract First: Evidence Is a Typed Artifact, Not Markdown Text
Current analysis outputs only `evidence_ids` on conclusions (`skills/github-researcher/lib/analysis/coverage/types.ts`).

Planning should lock a Phase 07 contract that introduces:
- `EvidenceRecord` (stable `evidence_id`, conclusion linkage, source location, snippet metadata, validation status),
- `CitationLinkSet` (`sha_url`, `default_branch_url`, `line_anchor`, `anchor_strategy`),
- `SnippetRecord` (function signature context, start/end lines, branch/exception label, truncation markers),
- `EvidenceValidationResult` (pass/fail per EVID requirement with reason codes).

Without this schema lock, link/snippet guarantees will drift across phases and tests.

### 2. Source-Location Canonicalization Is a Hard Dependency
Phase 07 requires deterministic URL generation from normalized repo identity + path + line range.

Planning should define canonicalization inputs:
- canonical owner/repo from intake/preflight,
- default branch,
- analyzed commit SHA,
- normalized repository-relative path,
- line start/end and anchor format.

The output must always produce dual links in fixed order:
1. SHA-pinned `blob/{sha}/...#Lx-Ly`
2. default-branch `blob/{defaultBranch}/...#Lx-Ly`

### 3. Snippet Selection Must Be Policy-Driven
Context already defines function-primary snippets, branch snippets, exception-path enforcement, and segmented long-function handling.

Planning should codify deterministic snippet policy:
- minimum `1 snippet + 1 citation` per key conclusion,
- add exception-path snippet for error/retry conclusions,
- segment long functions with explicit omission markers,
- semantic snippet labels (purpose-based, not only file/function names),
- stable ordering: mainline first, then branch/exception.

### 4. Validation/Revalidation Lifecycle Must Integrate Reliability
Phase 2/6 patterns already support checkpoint-safe stages and resumable metadata (`reliability/orchestrator.ts`, `progress-reporter.ts`).

Planning should add explicit evidence stages:
- `evidence_link_build`,
- `evidence_snippet_extract`,
- `evidence_validate`,
- `evidence_revalidate`,
- `evidence_freeze`.

Each stage should checkpoint evidence progress (completed IDs, stale IDs, unresolved queue) so interrupted runs resume without recomputing finished evidence.

### 5. Stale Evidence Is Tracked State, Not Deletion
Context decision requires stale evidence retention with explicit stale status and changelog semantics.

Planning should define:
- stale reason taxonomy (`path_moved`, `line_out_of_range`, `sha_missing`, `default_branch_mismatch`, `anchor_not_found`),
- bounded revalidation budget and carry-forward backlog,
- evidence changelog artifact (`added`, `replaced`, `stale`, `unchanged` with reason).

### 6. Boundary With Phase 8 Must Stay Strict
Phase 07 produces machine-readable evidence guarantees consumed by Phase 8.

Do not bake final report layout/visual ordering decisions here. Phase 07 should expose reliable evidence blocks and validation summaries only.

## Existing Implementation Surfaces to Reuse
- `skills/github-researcher/lib/analysis/coverage/types.ts`
  - existing `conclusion_id`, `key`, `evidence_ids` contracts are the right anchor point for expanded evidence payloads.
- `skills/github-researcher/lib/analysis/coverage/merge-coherence.ts`
  - conflict/adjudication lineage already exists and should carry citation-level provenance.
- `skills/github-researcher/lib/analysis/core/artifacts.ts`
  - established phase snapshot pattern (`phase` marker + `snapshot_version`) should be reused for a Phase 07 evidence snapshot.
- `skills/github-researcher/lib/reliability/orchestrator.ts`
  - checkpoint persistence and resume semantics are already implemented and should host evidence stage progression.
- `skills/github-researcher/lib/reliability/progress-reporter.ts`
  - deterministic stage event emission can be extended for evidence stage milestones.

## Recommended Architecture

## Standard Stack
- TypeScript contracts and reducers under `skills/github-researcher/lib/analysis/evidence/*` (new module tree).
- Existing reliability orchestration (`lib/reliability/*`) for stage execution, checkpointing, and resumability.
- Existing deterministic merge style from Phase 6 (`coverage/merge-coherence.ts`) for evidence dedup and conflict retention.
- Node `crypto` hash strategy aligned with existing fingerprint implementation (`lib/intake/fingerprint.ts`) for stable evidence IDs.

## Architecture Patterns
- Contract-first design: type schemas and invariants before stage wiring.
- Deterministic pure builders: citation URL builder, snippet selector, validation evaluator.
- Append-only evidence lifecycle: records can change status but not silently disappear.
- Dual-link invariants: SHA-first ordering enforced by serializer, not caller discipline.
- Checkpoint-at-stage-boundary: evidence stages persist progress snapshots to guarantee resumability.

## Don't Hand-Roll
- Do not build ad-hoc URL strings across callers; use one canonical citation builder.
- Do not keep evidence as free-form markdown fragments without typed structure.
- Do not perform implicit stale cleanup that removes historical traceability.
- Do not mix final report composition concerns (Phase 8) into Phase 07 core contracts.

## Common Pitfalls
- Generating line anchors from non-normalized paths causes broken links.
- Emitting only default-branch links breaks reproducibility after upstream changes.
- Snippet extraction tied only to file-level references fails EVID-03.
- Non-deterministic snippet ordering causes flaky tests and diff noise.
- Revalidation loops without budget controls stall unattended runs.

## Proposed Planning Contracts (Phase-Level)
Define these contracts before coding stage logic:
- `EvidenceRecord`
  - `evidence_id`, `conclusion_id`, `phase_id`, `path`, `module_id`, `snippet`, `citations`, `status`, `generated_at`, `validated_at`.
- `CitationPair`
  - `sha_url`, `default_branch_url`, `line_start`, `line_end`, `anchor_strategy`, `available` flags.
- `SnippetRecord`
  - `function_signature`, `line_start`, `line_end`, `content`, `segment_index`, `segment_total`, `omitted_ranges`, `label`, `kind(mainline|branch|exception)`.
- `EvidenceQuality`
  - rule-derived confidence tier from quantity/diversity/consistency signals and conflict penalties.
- `EvidenceSnapshotArtifact`
  - `phase: "07"`, `snapshot_version`, `records`, `stale_records`, `revalidation_backlog`, `changelog`.

## Plan-Slicing Guidance

### Slice 1: Evidence Contracts and Invariants
Deliverables:
- new evidence/citation/snippet types,
- invariants for EVID-01..04,
- deterministic ID and ordering rules.

Exit checks:
- schema round-trip tests,
- invalid records rejected with explicit reason codes.

### Slice 2: Citation Builder and Path Normalization
Deliverables:
- canonical GitHub URL builder,
- line-anchor formatter,
- dual-link serializer with SHA-first enforcement.

Exit checks:
- normalized path fixtures produce stable URLs,
- SHA + default links emitted when both available.

### Slice 3: Snippet Extraction and Selection Policy
Deliverables:
- function-level snippet locator,
- branch/exception snippet policy,
- long-function segmentation + omission markers.

Exit checks:
- key conclusions receive required minimum evidence,
- error/retry conclusions include exception-path snippets.

### Slice 4: Evidence Merge and Conflict Handling
Deliverables:
- dedup keyed by stable evidence IDs,
- conflict retention and confidence downgrade logic,
- evidence changelog generation.

Exit checks:
- conflicting evidence remains visible with adjudication rationale,
- no silent evidence removal.

### Slice 5: Reliability Integration and Revalidation
Deliverables:
- evidence stages wired into reliability orchestrator,
- checkpoint metadata for evidence progress,
- stale detection + bounded revalidation queue.

Exit checks:
- interruption resumes from pending evidence stage,
- revalidation backlog persists deterministically.

### Slice 6: Guardrails and Requirement Validation
Deliverables:
- unit + integration test matrix mapped to EVID-01..04,
- explicit boundary tests preventing Phase 8 leakage.

Exit checks:
- EVID requirement tests passing,
- evidence snapshot generated and parseable,
- deterministic output order across reruns.

## Validation Architecture
Validation should mirror existing project style: contract tests first, then integration/resume proofs.

1. Contract tests
- evidence schema parse/serialize stability,
- invalid dual-link ordering rejected,
- missing line anchors fail EVID-02 assertions,
- missing snippet for key finding fails EVID-03 assertions.

2. Citation builder tests
- canonical owner/repo/path normalization,
- exact `#Lx-Ly` anchor formatting,
- SHA and default-branch dual-link generation and ordering,
- fallback behavior when one link type is unavailable (explicit status, no silent pass).

3. Snippet policy tests
- function-level extraction produces bounded snippet ranges,
- long-function segmentation emits omission markers,
- exception-path enforcement for retry/error conclusions,
- deterministic snippet ordering for same inputs.

4. Evidence merge/conflict tests
- dedup uses stable `evidence_id` and preserves source lineage,
- conflicting snippets/citations remain visible in conflict history,
- confidence downgrades according to rule mapping.

5. Reliability integration tests
- evidence stages emit deterministic progress events,
- checkpoint snapshots persist evidence stage metadata,
- interrupted runs resume from the next pending evidence stage,
- revalidation budget overflow captured as unresolved backlog (not run failure unless policy says so).

6. End-to-end requirement mapping
- EVID-01: every key conclusion has at least one valid citation reference.
- EVID-02: every citation includes a resolvable GitHub line-anchored URL.
- EVID-03: every key finding includes at least one function/method-level snippet.
- EVID-04: dual links (SHA + default branch) emitted when available and ordered deterministically.

## Risks and Mitigations
1. Risk: Broken links caused by branch/path drift.  
Mitigation: canonical path normalization + stale detection + revalidation queue.

2. Risk: Evidence inflation (many weak snippets) reduces clarity.  
Mitigation: enforce minimum and quality thresholds, plus semantic label requirements.

3. Risk: Resume path duplicates evidence records after interruption.  
Mitigation: idempotent `evidence_id` generation and checkpoint-aware dedup.

4. Risk: Cross-phase coupling to final report renderer creates churn.  
Mitigation: freeze machine-readable evidence artifact boundary in Phase 07.

5. Risk: Revalidation cost explosion on large repos.  
Mitigation: impacted-only revalidation and bounded per-run budget with backlog carry-forward.

## Open Questions to Resolve During Planning
- Exact confidence threshold constants and downgrade weights.
- Exact stable-hash seed composition for `evidence_id`.
- Exact revalidation budget defaults and overflow policy.
- Exact fallback behavior when GitHub metadata cannot provide both SHA and default branch links.
- Fixture strategy for multi-language function extraction and edge-case anchors.

## Planning Recommendation
Use a **contract-first evidence pipeline**: define artifacts and invariants, then implement citation builder + snippet extraction, then integrate stale/revalidation behavior into reliability checkpoints.

This sequence minimizes regressions, satisfies EVID-01..04 directly, and keeps Phase 8 free to focus on report synthesis instead of evidence correctness.

## RESEARCH COMPLETE
