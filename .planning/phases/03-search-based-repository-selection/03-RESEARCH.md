# Phase 3: Search-Based Repository Selection - Research

**Researched:** 2026-03-04  
**Phase:** 03-search-based-repository-selection  
**Primary Requirement:** INPT-02

## Goal Alignment

Phase 3 must let users discover repositories by keyword, choose one result, and immediately launch the existing run pipeline.

- `INPT-02`: start a run by selecting a repository from keyword-based GitHub search results.
- Must preserve Phase 1 canonicalization guarantees and Phase 2 reliability semantics.

Success for this phase is not "search exists"; success is a deterministic `search -> select -> confirm -> preflight` flow with auditable metadata and consistent failure handling.

## Scope and Boundaries

In-scope:
- Query GitHub repository search endpoint with decided defaults (`stars`, page size `20`, `fork:false`, exclude archived by default).
- Return result cards with fields: repo name, description, stars, updated timestamp, repo URL.
- Single-result selection plus explicit confirmation.
- Immediate handoff into intake preflight (`runRepositoryPreflight`) and reliability orchestration.
- Structured empty-state guidance and structured error payloads.

Out-of-scope:
- Multi-select batch execution.
- Rich detail panel/drawer and advanced reranking.
- New analysis/reporting behavior.

## What Must Be Known Before Planning

Lock these decisions in planning before implementation starts:

1. Search-stage placement in run lifecycle:
- Either treat search+selection as pre-run UX step, or as first reliability stage (`search_select`) with checkpoint metadata.
2. Pagination behavior:
- Confirm whether v1 supports only first page or explicit next-page action.
3. Query construction policy:
- Exact handling for quotes, whitespace collapse, optional language filter, and include-forks toggle.
4. Confirmation payload contract:
- Minimum fields persisted to run context (`query`, `sort`, `result_rank`, `selected_repo_full_name`, `selected_repo_url`).
5. Search failure classification mapping:
- Which HTTP statuses map to existing intake error classes/codes versus new search-specific codes.

## Implementation Options

## Option A (Recommended): Modular Search Intake Layer

Add a dedicated `search` module parallel to `intake`, then bridge selection to existing preflight.

Why recommended:
- Preserves separation of concerns and testability.
- Reuses established intake/reliability contracts without overloading intake parser semantics.
- Keeps Phase 4 local-path intake independent.

Core flow:
1. `searchRepositories(query, options)` returns normalized result set + diagnostics.
2. User selects one result and confirms.
3. Selected `full_name` (`owner/repo`) is passed to `runRepositoryPreflight`.
4. Preflight output enters `runWithReliability` stages as today.

## Option B: Extend `intake` to Accept Search Queries Directly

Treat raw query text as another intake input type and resolve to repo before preflight success.

Pros:
- Single entrypoint contract.

Cons:
- Blurs deterministic "target validation" with non-deterministic search discovery.
- Increases parser complexity and makes INPT-01/INPT-04 regression risk higher.

## Option C: Reliability-First Search Stage

Model search/select as mandatory reliability stages (`discover`, `confirm`, `preflight`).

Pros:
- Full checkpoint/resume semantics for discovery path.

Cons:
- Higher orchestration complexity for v1; interactive confirmation may not map cleanly to unattended stage semantics.

Recommendation: implement Option A now; keep Option C as future refactor if interactive checkpoint resume becomes required.

## Standard Stack

- TypeScript modules under `skills/github-researcher/lib/`.
- GitHub REST Search API (`/search/repositories`) via existing HTTP client pattern from `lib/intake/github-client.ts`.
- Existing retry primitive `lib/intake/retry.ts` for bounded retries.
- Existing error taxonomy style from `lib/intake/error-codes.ts` and `lib/intake/types.ts`.
- Existing reliability orchestration `lib/reliability/orchestrator.ts` for run execution after selection.
- Vitest tests in `tests/` with mocked HTTP clients.

## Architecture Patterns

- Edge normalization pattern: normalize search options before calling upstream API.
- Adapter pattern: `github-search-client` converts raw GitHub payloads into internal `SearchResultItem` contract.
- Confirm-before-side-effects pattern: run starts only after explicit user confirmation.
- Bridge-to-canonical pattern: always route selected result through `runRepositoryPreflight` before execution.
- Append-only run metadata pattern: persist search decision data for auditability.

## Suggested Module Design

Add:
- `skills/github-researcher/lib/search/types.ts`
- `skills/github-researcher/lib/search/query-builder.ts`
- `skills/github-researcher/lib/search/github-search-client.ts`
- `skills/github-researcher/lib/search/search-service.ts`
- `skills/github-researcher/lib/search/index.ts`

Key contracts:
- `SearchRequest`: `query`, `sort`, `order`, `page`, `per_page`, `include_forks`, `language?`.
- `SearchResultItem`: `full_name`, `owner`, `repo`, `description`, `stars`, `updated_at`, `html_url`, `archived`, `fork`.
- `SearchSuccess`: items + total_count + query_diagnostics + applied_filters.
- `SearchFailure`: same style as intake failure (`error_class`, `error_code`, `summary`, `retryable`, `details`).

## Integration Points

Primary code integration points:

- Reuse canonical preflight handoff at [preflight.ts](/Users/eddy/.openclaw/workspace/knowledge-base/skills/github-researcher/lib/intake/preflight.ts:22).
- Extend GitHub API calling conventions from [github-client.ts](/Users/eddy/.openclaw/workspace/knowledge-base/skills/github-researcher/lib/intake/github-client.ts:85).
- Align error class/code style from [error-codes.ts](/Users/eddy/.openclaw/workspace/knowledge-base/skills/github-researcher/lib/intake/error-codes.ts:1).
- Launch execution through reliability runner in [orchestrator.ts](/Users/eddy/.openclaw/workspace/knowledge-base/skills/github-researcher/lib/reliability/orchestrator.ts:101).

State/artifact integration:
- Record `search_context` in run metadata:
  - `query_text`, `sort_mode`, `page`, `result_rank`, `selected_full_name`, `selected_html_url`, `selected_stars`, `selected_updated_at`.
- Ensure resume behavior uses selected repo identity; do not rerun search on resume.

Skill/pattern alignment (`.claude/skills/github-deep-research`):
- Keep deterministic reportable evidence: retain source URL and rank metadata for "why this repo was selected."
- Favor explicit, structured outputs over free-form logs.

## Error and Empty-State Policy

- Empty result set: return actionable rewrite guidance (broaden keywords, remove language filter, include forks toggle).
- Rate limit/transient upstream failures: bounded retry with visible attempt progress.
- Permission/input-like failures: no retry, clear remediation text.
- Preserve machine-readable failure payload for orchestration and test assertions.

## Common Pitfalls

- Skipping preflight after selection can violate INPT-04 guarantees.
- Mixing UI sort labels with API sort values can cause incorrect result ordering.
- Overly aggressive query rewriting can hide user intent and reduce trust.
- Not persisting selected result rank/context weakens auditability.
- Treating "no results" as generic error instead of guidance breaks usability goals.

## Don't Hand-Roll

Do not implement:
- A custom HTTP stack for search separate from existing intake client conventions.
- Bespoke retry loops outside shared retry helper.
- Ad-hoc error strings without stable codes/classes.
- Selection-to-run shortcuts that bypass canonical validation.

## Verification Notes (INPT-02 Mapping)

Minimum validation layers:

1. Search client unit tests:
- query builder applies default filters and optional toggles correctly.
- upstream payload mapping into `SearchResultItem`.
- status-classification and retryability behavior.

2. Search service tests:
- empty results return suggestions payload.
- transient failures retry up to bounded attempts.
- archived/fork filtering matches context defaults.

3. Selection bridge tests:
- selected `full_name` is passed to `runRepositoryPreflight`.
- confirmation gate enforced before run launch.
- selection metadata is persisted into run context.

4. Integration tests (mocked HTTP + mocked run start):
- `search -> select -> confirm -> preflight` happy path.
- no-results path with rewrite guidance.
- rate-limit path with retry then failure summary.
- resume path confirms no repeated search call after checkpointed selection.

Exit criteria for Phase 3:
- user can start run from search result selection with confirmation.
- selected repository always canonicalized through preflight.
- search failures and empty states are structured and actionable.
- tests explicitly cover `INPT-02` behavior boundaries.

## Risks and Mitigations

- Risk: GitHub search relevance drift yields surprising top results.
- Mitigation: explicit sort control (`stars`, `updated`, `best match`) and surfaced ranking metadata.

- Risk: API rate limits during broad keyword queries.
- Mitigation: bounded retry, clear backoff progress, user guidance to refine query.

- Risk: wrong-target run starts from misclick or ambiguous names.
- Mitigation: mandatory confirmation step with canonical `owner/repo` display.

- Risk: contract drift between search payload and intake expectations.
- Mitigation: strict bridge tests asserting selected `full_name -> preflight` conversion.

## Planning Implications

Recommended plan slices:

1. Define search domain contracts and error codes aligned with intake style.
2. Implement GitHub search client + query builder with default filter policy.
3. Implement search service orchestration (retry, empty-state guidance, response mapping).
4. Implement selection confirmation + preflight bridge.
5. Integrate selected-search metadata into run context for auditability and resume compatibility.
6. Add unit/integration tests mapped to `INPT-02` scenarios.

## Research Conclusion

Phase 3 should add a dedicated search module that feeds a confirmed selection into the existing preflight and reliability pipeline. This achieves `INPT-02` with minimal regression risk, preserves prior phase guarantees, and keeps repository-choice decisions auditable.
