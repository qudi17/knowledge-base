# 04 Research: Local Repository Input (INPT-03)

**Date:** 2026-03-04  
**Phase:** 04-local-repository-input  
**Requirement focus:** INPT-03  
**Scope lock:** local repository input + launch compatibility with existing reliability flow only

## Research Objective

Define how to add local repository path intake so a run can start from a local path and then enter the same reliability/orchestration flow already used by URL/search inputs.

## What Must Be True at Phase Exit

- A user can provide a local path (absolute or relative) and start a run.
- Intake resolves to a git repository root, not arbitrary subdirectories.
- Intake returns a structured success/failure payload compatible with existing intake contracts.
- Deterministic local input failures do not consume retry loops.
- Successful local intake launches through the same reliability entrypoint and stage semantics used today.

## Existing Baseline (Code-Backed)

- Current intake flow is deterministic parse -> normalize -> validate -> canonicalize (`lib/intake/preflight.ts`).
- Intake contracts are strict discriminated unions (`IntakeSuccess | IntakeFailure`) with machine-readable diagnostics (`lib/intake/types.ts`).
- Reliability orchestration retries transient stage failures and classifies terminal reasons (`lib/reliability/orchestrator.ts`, `lib/reliability/retry-policy.ts`).
- Existing error taxonomy is GitHub/API-centric and needs local extensions (`lib/intake/error-codes.ts`).

## Implementation Options

### Option A: Extend Current Intake Pipeline With Local Branch (Recommended)

Approach:
- Keep `runRepositoryPreflight` as the single entry API.
- Add local input parse/normalize/validate/resolve path in the same preflight stage.
- Return the same `IntakeResult` shape with local-specific metadata.

Pros:
- Minimal architecture churn.
- Preserves Phase 1 deterministic intake style and test patterns.
- Simplest compatibility path with reliability stage wiring.

Cons:
- `types.ts` and parser logic become broader and require careful union design.

### Option B: Add Separate `runLocalRepositoryPreflight` and Merge Later

Approach:
- Build a local-only preflight module.
- Dispatch at caller level to `runRepositoryPreflight` or local version.

Pros:
- Lower risk to existing URL/search path during implementation.
- Easier isolated unit testing at first.

Cons:
- Duplicated orchestration behavior unless refactored.
- Higher chance of drift between input modes.

### Option C: New Intake Strategy Interface + Pluggable Resolvers

Approach:
- Introduce explicit strategy abstraction (github-url/search/local).
- Shared contract, separate resolver implementations.

Pros:
- Clean long-term extensibility.

Cons:
- Over-scoped for Phase 04.
- Adds refactor risk unrelated to INPT-03.

## Recommendation

Use **Option A** for Phase 04.

Reason:
- It delivers INPT-03 with least disruption and strongest compatibility with the already-tested reliability framework.
- It aligns with explicit phase guardrails (single-repo local input, deterministic failures, no side effects).

## Proposed Design Details

## Standard Stack

- Node.js `fs`/`fs.promises` for path existence/readability checks.
- Node.js `path` for absolute/relative normalization.
- Shelling to `git` (`rev-parse`, `symbolic-ref`, `config`) via existing runtime command mechanism used by the project.
- Existing intake/reliability modules (`lib/intake/*`, `lib/reliability/*`).
- Vitest for intake and reliability integration tests.

## Architecture Patterns

- Reuse existing intake pipeline phases with local-specific resolver branch.
- Preserve strict typed success/failure contracts.
- Keep local-specific deterministic failures non-retryable at intake stage.
- Emit normalized canonical metadata early and pass through unchanged to run context.

## Contract Additions (Minimum)

1. Extend `InputType` with `"local_path"`.
2. Extend normalized target model to support local metadata. Suggested structure:
- Keep current GitHub fields for remote mode.
- Add local branch fields:
  - `normalized_path`
  - `repo_root`
  - `repo_name`
  - `canonical_id` (`remote owner/repo` if derivable, else `local:<repo-name>`)
  - `canonical_url` (remote URL if derivable, else empty string or omitted)
3. Extend repository metadata:
- Allow `visibility: "public" | "private" | "local"`.
- Keep `default_branch` semantics for local by reading HEAD symbolic ref, fallback `main`.

## Local Resolver Flow (Deterministic)

1. Parse input as local path candidate when not matching URL/shorthand patterns.
2. Normalize path:
- trim
- expand `~`
- resolve relative path from cwd
- `realpath`
- remove trailing slash
3. Validate filesystem conditions:
- exists
- readable
- directory (or file-inside-repo allowed only if explicitly chosen)
4. Resolve git repo root:
- `git -C <path> rev-parse --show-toplevel`
5. Resolve branch:
- `git -C <repo_root> symbolic-ref --short HEAD`
- fallback `main` when detached/unresolved
6. Resolve canonical identity:
- try remote (`origin` preferred, deterministic fallback order)
- parse owner/repo when GitHub-like remote is present
- else fallback `local:<repo-name>`
7. Return `IntakeSuccess` with local metadata + `visibility: "local"`.

## Error Taxonomy Additions

Add local codes in `error-codes.ts` (all non-retryable):
- `PATH_NOT_FOUND`
- `PATH_NOT_READABLE`
- `NON_GIT_DIRECTORY`
- `GIT_METADATA_UNRESOLVED`

Classification guidance:
- Filesystem/path issues: `INPUT_ERROR` when user-fixable path selection.
- Permission denial (`EACCES` class): `PERMISSION_OR_UNSUPPORTED`.
- Git command/tool missing/corrupt repo metadata: `PERMISSION_OR_UNSUPPORTED` or `INPUT_ERROR` depending on detectability; keep deterministic and non-retryable.

Each local failure should include:
- normalized attempted path
- short summary
- 2-3 actionable suggestions

## Integration Points

1. **Intake parser/normalizer/validator/preflight**
- Files: `lib/intake/parser.ts`, `normalizer.ts`, `validator.ts`, `types.ts`, `preflight.ts`, `error-codes.ts`.
- Goal: accept local path and emit compatible `IntakeResult`.

2. **Reliability stage wiring**
- File: launch/orchestration stage that invokes preflight before analysis (same stage boundary currently used).
- Goal: local deterministic failures terminate cleanly without transient retry churn.

3. **Checkpoint/resume fingerprint compatibility**
- Files: reliability entry code + `lib/reliability/orchestrator.ts` consumers.
- Goal: include stable local canonical metadata/fingerprint so resume behavior remains predictable across reruns.

4. **Progress and diagnostics**
- Ensure stage logs include local mode context (`normalized_path`, `repo_root`) for traceability without changing reliability semantics.

## Don’t Hand-Roll

- Custom git parser for `.git/config` internals.
- Custom retry subsystem for local intake.
- New reliability mode for local runs.

Use existing reliability engine and simple `git` command interrogation instead.

## Common Pitfalls

- Treating any existing directory as valid repo without git root resolution.
- Ambiguous behavior for detached HEAD or missing branch metadata.
- Inconsistent canonical ID format between local and remote modes.
- Local failures accidentally marked retryable, causing wasteful retries.
- Allowing path normalization differences to break fingerprint/resume stability.

## Risks And Mitigations

1. Risk: Local contract changes break existing URL/search tests.
- Mitigation: keep backward-compatible fields; add discriminated narrowing on `input_type`.

2. Risk: Cross-platform path behavior divergence (`~`, symlinks, spaces).
- Mitigation: centralize normalization and add matrix tests for representative path shapes.

3. Risk: Multiple remotes create unstable canonical mapping.
- Mitigation: define strict precedence (`origin` first, then sorted deterministic fallback).

4. Risk: `git` unavailable in environment.
- Mitigation: deterministic `GIT_METADATA_UNRESOLVED` failure with remediation guidance.

5. Risk: Reliability terminal reason misclassified as transient.
- Mitigation: ensure local intake failures are emitted as hard/non-retryable failure context.

## Verification Notes (What Plan Must Test)

### Unit Tests (Intake)

- Parse local absolute path -> `input_type=local_path`.
- Parse local relative path -> normalized absolute path from cwd.
- `~` expansion works.
- Subdirectory inside repo resolves to repo root.
- Nonexistent path -> `PATH_NOT_FOUND` (non-retryable).
- Permission denied path -> `PATH_NOT_READABLE` (non-retryable).
- Non-git directory -> `NON_GIT_DIRECTORY` (non-retryable).
- Missing branch metadata -> fallback `main`.
- Remote present -> canonical owner/repo mapping.
- No remote -> `canonical_id=local:<repo-name>`.

### Contract/Compatibility Tests

- Existing GitHub URL/shorthand tests remain green without behavior regression.
- `IntakeResult` shape remains compatible with downstream consumers.
- Error summaries/details remain structured and actionable.

### Reliability Integration Tests

- Local deterministic intake failure terminates run immediately with non-retryable semantics.
- Local successful intake enters next stage and run completes through existing orchestrator.
- Resume behavior with local input uses stable fingerprint and does not restart completed stages.

## Planning Notes For Phase 04

- Keep this phase limited to intake and launch compatibility only.
- Do not add analysis/report/reporting changes.
- Do not add auth/private-repo features.
- Prefer one migration PR shape: types/error-codes -> resolver/preflight -> tests -> reliability integration assertions.

## Confidence

- **High:** Integration boundaries, failure semantics, and recommended architecture pattern.
- **Medium:** Exact local metadata field shape needed by downstream unrevealed consumers (should be confirmed during planning task decomposition).
