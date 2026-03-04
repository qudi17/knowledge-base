# Phase 4: Local Repository Input - Context

**Gathered:** 2026-03-04
**Status:** Ready for planning

<domain>
## Phase Boundary

This phase enables starting the same research workflow from a local repository directory path.

This phase does not add new analysis/reporting capabilities and does not expand into private GitHub authentication or multi-repo batch orchestration.

</domain>

<decisions>
## Implementation Decisions

### Local Path Intake Boundaries
- v1 accepts both absolute and relative local paths.
- Relative paths resolve from current execution working directory, then are normalized.
- Path normalization applies: expand `~`, resolve `realpath`, and remove trailing slash.
- Path scope is not restricted to workspace-only; any readable local path is allowed.
- Normalized absolute path is recorded for traceability.

### Repository Detection and Canonical Identity
- If input points to a subdirectory inside a git repo, intake resolves to repository root automatically.
- A valid target must resolve to a parsable git repository; non-git directories are rejected.
- Canonical identity strategy: prefer deriving from git remote when available; fallback to `local:<repo-name>`.
- Default branch strategy: read git `HEAD` symbolic ref; fallback to `main` when unresolved.
- Local input visibility is recorded as `local` (not `public/private`).

### Error and Recovery Policy
- Missing path returns immediate structured failure with actionable remediation guidance.
- Non-git directory returns structured failure with explicit “initialize git or choose another repo” guidance.
- Permission errors (`EACCES`-class) are classified as permission failures and do not auto-retry.
- Local path-class errors are deterministic and do not use automatic retry loops.
- Error outputs include structured payload + human-readable summary + normalized path context.

### Error Taxonomy and Logging
- Introduce local-specific error codes (for example: `PATH_NOT_FOUND`, `PATH_NOT_READABLE`, `NON_GIT_DIRECTORY`, `GIT_METADATA_UNRESOLVED`).
- Each local error includes 2-3 executable recovery suggestions.
- Path logging policy: full normalized absolute path by default, with future configurable redaction support.

### Scope Guardrails
- Phase 4 remains single local repository input per run.
- No automatic repo creation (`git init`) side effects.
- No automatic fallback to other directories when user path fails.

### Claude's Discretion
- Exact shell/git command composition for robust cross-platform root/branch detection.
- Exact remote-selection precedence when multiple remotes exist.
- Exact formatting of remediation message templates while preserving structured error schema.

</decisions>

<specifics>
## Specific Ideas

- Keep local-input behavior deterministic and auditable, matching the strict intake style established in Phase 1.
- Preserve unattended reliability principles from Phase 2: deterministic stop on non-retryable local errors.
- Ensure local mode and GitHub URL/search mode share downstream run semantics after intake normalization.

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `skills/github-researcher/lib/intake/preflight.ts`: existing preflight orchestration structure can be extended with a local preflight branch.
- `skills/github-researcher/lib/intake/types.ts`: structured success/failure contract style to mirror for local input results.
- `skills/github-researcher/lib/intake/error-codes.ts`: reusable taxonomy pattern, with local-specific additions.
- `skills/github-researcher/lib/reliability/orchestrator.ts`: existing run lifecycle can consume normalized local intake outputs without behavior divergence.

### Established Patterns
- Intake path uses deterministic parse -> normalize -> validate -> resolve flow with structured diagnostics.
- Error responses are machine-readable plus human-readable summaries.
- Resume and checkpoint behavior is keyed by stable run input fingerprint; local canonical metadata must support this.

### Integration Points
- Local path resolver should feed canonicalized repository metadata into the same run launch pipeline used by URL/search flows.
- Local input metadata (normalized path, detected repo root, selected branch baseline) should be available in run context for auditability.
- Local intake failure classes must map cleanly into reliability terminal reasoning without noisy retries.

</code_context>

<deferred>
## Deferred Ideas

- Path access policy controls (allow-list/deny-list) beyond current unrestricted readable-path default.
- Advanced path redaction modes in logs/reports.
- Multi-repository local batch selection.

</deferred>

---
*Phase: 04-local-repository-input*
*Context gathered: 2026-03-04*
