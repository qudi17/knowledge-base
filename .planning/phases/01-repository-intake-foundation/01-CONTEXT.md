# Phase 1: Repository Intake Foundation - Context

**Gathered:** 2026-03-04
**Status:** Ready for planning

<domain>
## Phase Boundary

This phase delivers robust repository intake for GitHub targets: accept supported input forms, validate and normalize them, and produce a canonical repository identity for downstream run execution.

This phase does not add new analysis capabilities; it only defines reliable intake behavior for Phase 1 scope.

</domain>

<decisions>
## Implementation Decisions

### URL Input Boundaries
- v1 accepts multiple input forms: standard GitHub URL, `.git` suffix URLs, `tree/blob` subpath URLs, and `@owner/repo` shorthand.
- If user provides a subpath URL, intake automatically normalizes it back to repository root (`owner/repo`) and continues.
- Non-`github.com` hosts are explicitly rejected in v1 with actionable migration guidance.
- Owner/repo display preserves user-visible casing, while internal matching is case-insensitive.

### Validation and Auto-Fix Policy
- Auto-fix is limited to safe normalization only (trim spaces, remove trailing slash, strip `.git`, collapse subpath to root).
- Suspected owner/repo typos are not auto-corrected; system fails validation and returns correction suggestions.
- Validation order is fixed: syntax validation -> normalization -> remote existence check.
- When auto-fix is applied, system must surface what was normalized for traceability.

### Canonical Identity Rules
- Canonical repository identifier is `owner/repo`.
- Logs/reports should include both human-readable display name and canonical identifier.
- Run/cache key basis: `canonical_id + resolved_default_branch`.
- If input identity and GitHub API canonical identity differ (rename/transfer), API canonical identity wins and mapping from input -> canonical is recorded.

### Preflight Failure Handling
- Preflight failures are classified into three user-facing classes: input error, permission/unsupported error, transient error.
- Private repository in v1 returns explicit `Unsupported` status with actionable next-step guidance.
- Rate limits and transient network/API failures use bounded exponential-backoff retry, then fail with preserved diagnostics.
- Error output format is structured object + human-readable summary.

### Claude's Discretion
- Exact suggestion-generation strategy for typo hints (edit distance, heuristics, or API-assisted lookup).
- Exact retry backoff constants and max-attempt defaults.
- Final wording templates for user-facing error summaries.

</decisions>

<specifics>
## Specific Ideas

- Intake should be forgiving on syntax forms but strict on semantic identity correctness.
- Normalization should improve UX without hiding what happened.
- Failures must be actionable because runs are often unattended and reviewed later.

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `skills/github-researcher/SKILL.md`: existing skill definition can be reused as integration entry and command surface reference for Phase 1 behavior.
- `skills/github-researcher/references/report-template.md`: existing output contract helps align intake metadata fields used later in report generation.
- `skills/github-researcher/references/rubric.md`: existing quality rubric can inform acceptance checks for intake diagnostics clarity.

### Established Patterns
- Repository has repeated Markdown-first artifact workflow (`GitHub/*/final-report.md`, phase files, checklist files), favoring structured, auditable output.
- Existing workflow prefers explicit stage artifacts and deterministic naming; intake metadata should follow the same deterministic conventions.

### Integration Points
- Intake normalization outputs should feed the skill pipeline under `skills/github-researcher/` as canonical run inputs.
- Canonical identity and preflight diagnostics should be persisted in run artifacts used by later analysis/report stages.

</code_context>

<deferred>
## Deferred Ideas

- Private-repository authentication and enterprise host support (`github.enterprise`) are deferred to a future phase.
- Broader multi-host repository intake (GitLab/Bitbucket) is deferred to future scope.

</deferred>

---
*Phase: 01-repository-intake-foundation*
*Context gathered: 2026-03-04*
