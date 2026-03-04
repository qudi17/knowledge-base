# Phase 3: Search-Based Repository Selection - Context

**Gathered:** 2026-03-04
**Status:** Ready for planning

<domain>
## Phase Boundary

This phase adds keyword-based GitHub repository discovery and single-result selection that launches analysis immediately through the existing intake/reliability pipeline.

This phase does not add new analysis depth features, report synthesis features, or multi-repository batch execution.

</domain>

<decisions>
## Implementation Decisions

### Search Result Presentation
- Default search sorting uses `stars` to prioritize high-impact repositories for research selection.
- Default page size is `20` results.
- Default visible fields are: repository name, short description, stars count, and last updated timestamp.
- Fork repositories are excluded by default (`fork:false` behavior); optional inclusion can be a user action.
- Archived repositories are excluded by default.
- Default search has no mandatory language filter; language filtering stays optional.
- Sorting can be switched from default stars to `updated` and `best match`.
- Each result row includes a read-only link to open the repository homepage for manual inspection.

### Selection and Launch Flow
- Selection mode is single-select only in v1 phase scope.
- After selecting a result, one explicit confirmation step is required before run start.
- “Immediate launch” means entering Phase 1 preflight immediately after confirmation.
- Resume behavior binds to `run_id` checkpoint semantics from Phase 2; resume does not re-run search.

### Empty/Failure Handling
- Empty search results return actionable rewrite suggestions (keyword relaxation/variation guidance), not silent empty responses.
- Rate-limit and transient search failures use automatic retry with visible progress aligned to Phase 2 behavior.
- Search errors are surfaced as structured error payload + human-readable summary.
- Primary recovery action after search failure is retry with the same query.

### Scope Guardrails
- Phase 3 remains single-target selection only; no multi-select batch start.
- Rich repository detail panels/drawers are deferred to future phases.
- Deep relevance ranking beyond sortable GitHub-native modes is deferred.

### Claude's Discretion
- Exact query-construction defaults beyond decided filters (tokenization, quoting heuristics).
- Exact confirmation copy and warning text style.
- Exact pagination strategy details while keeping default page size at 20.

</decisions>

<specifics>
## Specific Ideas

- Keep selection speed high for unattended overnight runs while minimizing wrong-target launches.
- Preserve transparent behavior: users should clearly see why a repository appeared and why a run started.
- Treat “search -> select -> confirm -> preflight” as one continuous flow with minimal branching.

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `skills/github-researcher/lib/intake/preflight.ts`: direct handoff target once a repository is selected.
- `skills/github-researcher/lib/intake/parser.ts` and `normalizer.ts`: canonical owner/repo normalization and validation path already exists.
- `skills/github-researcher/lib/intake/github-client.ts`: GitHub API call patterns and retry-aware intake boundary can be extended for search endpoint usage.
- `skills/github-researcher/lib/reliability/orchestrator.ts`: run lifecycle, retry visibility, and resume-safe semantics to reuse for search-triggered runs.

### Established Patterns
- Intake currently uses structured success/failure contracts; search should emit the same contract style.
- Reliability layer already defines transition/cadence progress behavior; search stage should publish into that model.
- Project artifacts favor deterministic, auditable outputs; search decisions should remain traceable in run metadata.

### Integration Points
- New search-selection module should resolve chosen result to canonical `owner/repo` and then call intake preflight.
- Selected result metadata (query, sort mode, rank position) should be captured into run context for auditability.
- Search-stage errors should map into existing failure classes to keep terminal behavior consistent.

</code_context>

<deferred>
## Deferred Ideas

- Multi-result compare-and-pick workflow.
- Repository detail drawer/preview inside selection step.
- Advanced reranking and personalized recommendation strategy.

</deferred>

---
*Phase: 03-search-based-repository-selection*
*Context gathered: 2026-03-04*
