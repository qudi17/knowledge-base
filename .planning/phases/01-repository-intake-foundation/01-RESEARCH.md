# Phase 1: Repository Intake Foundation - Research

**Researched:** 2026-03-04  
**Phase:** 01-repository-intake-foundation  
**Primary Requirements:** INPT-01, INPT-04

## Goal Alignment

Phase 1 must make repository intake deterministic and auditable before any analysis pipeline work.

- `INPT-01` requires accepting a GitHub repository URL as run input.
- `INPT-04` requires validating the target and normalizing to canonical `owner/repo` before analysis.

Success for this phase is a reusable intake component that always emits either:
- a canonical target object (`owner/repo`, normalized URL, default branch, metadata), or
- a structured failure with actionable remediation.

## Scope and Boundaries

In-scope for Phase 1:
- Parse/accept GitHub URL forms and shorthand defined in context.
- Normalize to repository root identity.
- Validate syntax, host policy, and repository existence.
- Resolve canonical identity from GitHub API (rename/transfer-safe).
- Classify preflight failures into user-facing categories.

Out-of-scope for Phase 1:
- Search-based selection (`INPT-02`), local path intake (`INPT-03`).
- Private-repo auth support (explicitly deferred).
- Full run orchestration/retry checkpoint framework (Phase 2).

## Inputs Contract (INPT-01)

Accepted v1 forms:
- `https://github.com/<owner>/<repo>`
- `https://github.com/<owner>/<repo>.git`
- `https://github.com/<owner>/<repo>/tree/<branch>/<path...>`
- `https://github.com/<owner>/<repo>/blob/<branch>/<path...>`
- `@<owner>/<repo>` shorthand

Rejected inputs:
- Non-`github.com` hosts
- Missing owner/repo segments
- URLs with unsupported schemes or malformed path structure

Implementation note:
- Keep parser tolerant at input edge, but strict before emission of canonical identity.

## Canonicalization and Validation Flow (INPT-04)

Ordered pipeline (must remain stable):
1. **Syntax parse**
- trim whitespace
- parse URL or shorthand
- extract candidate `owner`, `repo`, host, optional subpath markers

2. **Safe normalization**
- remove trailing slash
- strip `.git`
- collapse `tree/blob` URLs to repository root
- preserve display casing for UX; create lowercased compare key for matching

3. **Policy validation**
- enforce host == `github.com`
- fail fast for unsupported hosts with migration guidance

4. **Remote existence + canonical identity resolution**
- call GitHub repository endpoint on normalized candidate
- on success, replace with API-returned canonical owner/repo
- record `input -> canonical` mapping when rename/transfer/casing differs

5. **Default branch resolution**
- persist resolved default branch for downstream run/cache keying

6. **Final output assembly**
- produce structured success object with diagnostics and applied normalizations

## Canonical Data Model

```json
{
  "input_raw": " https://github.com/FooOrg/BarRepo.git ",
  "input_type": "github_url",
  "normalized": {
    "host": "github.com",
    "owner": "FooOrg",
    "repo": "BarRepo",
    "canonical_id": "FooOrg/BarRepo",
    "canonical_compare_key": "fooorg/barrepo",
    "canonical_url": "https://github.com/FooOrg/BarRepo"
  },
  "repository": {
    "default_branch": "main",
    "visibility": "public",
    "exists": true
  },
  "normalizations_applied": ["trim_whitespace", "strip_dot_git"],
  "identity_mapping": {
    "input_id": "FooOrg/BarRepo",
    "api_canonical_id": "FooOrg/BarRepo",
    "changed": false
  }
}
```

## Error Taxonomy and UX Contract

Return both machine-readable and human-readable forms.

Error classes (from context decisions):
- `INPUT_ERROR`
- `PERMISSION_OR_UNSUPPORTED`
- `TRANSIENT_ERROR`

Suggested stable payload shape:

```json
{
  "ok": false,
  "error_class": "INPUT_ERROR",
  "error_code": "INVALID_REPOSITORY_FORMAT",
  "message": "Repository must be a GitHub URL or @owner/repo.",
  "details": {
    "input": "github.com/foo",
    "host": null,
    "suggestions": ["https://github.com/owner/repo", "@owner/repo"]
  },
  "retryable": false
}
```

Behavioral requirements:
- Normalizations are surfaced explicitly; do not silently mutate input.
- Typo handling is suggestive only; no auto-correction of owner/repo identity.
- Private repositories in v1 return `PERMISSION_OR_UNSUPPORTED` with next-step guidance.
- Transient GitHub/network failures use bounded retry, then preserve diagnostics.

## Implementation Architecture

Recommended module boundaries:
- `intake/parser`:
  - parse URL/shorthand into candidate struct
- `intake/normalizer`:
  - safe normalization transforms + provenance list
- `intake/validator`:
  - host/pattern/policy checks
- `intake/github_client`:
  - existence lookup, canonical identity fetch, default branch resolution
- `intake/preflight`:
  - orchestrates pipeline and builds final success/failure object
- `intake/errors`:
  - typed error catalog (`error_code`, `error_class`, retryability)

Integration target:
- Emit canonical target contract consumed by `skills/github-researcher` workflow and run artifact generation.

## Observability and Traceability

For each intake execution, persist:
- input form and normalized canonical identity
- list of applied normalization steps
- mapping from input identity to API canonical identity
- preflight classification and code on failures
- retry attempts and final retry outcome for transient errors

This supports unattended runs, auditability, and future reliability phases.

## Validation Architecture

Nyquist-focused validation should combine deterministic unit coverage plus minimal integration checks.

Validation layers:
1. **Parser/Normalizer Unit Tests**
- valid URL variants (`.git`, `tree`, `blob`, trailing slash, shorthand)
- malformed syntax and missing segments
- normalization provenance list correctness

2. **Policy Validation Unit Tests**
- reject non-`github.com` hosts
- case-insensitive compare key correctness
- no auto-correction of owner/repo typos

3. **GitHub Client Contract Tests**
- success path with canonical identity returned by API
- rename/transfer scenario (`input_id != api_canonical_id`)
- private repository classification
- transient failures with bounded retry and terminal classification

4. **Preflight End-to-End Tests (Mocked HTTP)**
- full `input -> canonical success object`
- full `input -> structured failure object`
- verify fixed order: syntax -> normalization -> remote validation

5. **Artifact Validation Hooks**
- ensure emitted object contains fields needed by downstream phases (`canonical_id`, `default_branch`, diagnostics)

Coverage mapping:
- `INPT-01`: validated by accepted/rejected input form tests and successful URL intake integration.
- `INPT-04`: validated by canonicalization assertions, API canonical override, and preflight ordering tests.

Exit criteria for Phase 1:
- all `INPT-01` acceptance scenarios pass
- all `INPT-04` canonicalization/validation scenarios pass
- failure taxonomy assertions pass for all three classes

## Planning Implications

Recommended plan structure for Phase 1:
1. Define intake domain types, error catalog, and output contract.
2. Implement parser + normalizer with provenance tracking.
3. Implement policy validator and host guardrails.
4. Implement GitHub preflight client (existence + canonical + default branch).
5. Implement orchestrator pipeline with strict stage order.
6. Add comprehensive tests mapped to `INPT-01`/`INPT-04`.
7. Add stage-level logging and artifact persistence for diagnostics.

Key technical decisions to lock during planning:
- exact regex/parser strategy for shorthand and URL variants
- retry constants (attempt count/backoff bounds)
- suggestion generation heuristics for invalid owner/repo

## Risks and Mitigations

- Risk: ambiguous parsing of branch/path in `tree/blob` URLs.
- Mitigation: parse only owner/repo for Phase 1 and explicitly ignore downstream path semantics.

- Risk: over-normalization can hide user intent.
- Mitigation: strict provenance (`normalizations_applied`) and explicit user-facing summary.

- Risk: GitHub API variance (rate limits, transient 5xx) can blur input errors.
- Mitigation: stable classification policy and bounded retries before terminal fail.

## Open Questions for Plan Phase

- What concrete retry policy values should be defaulted in v1 (attempts/base/max)?
- Should suggestion generation rely only on local heuristics or GitHub-assisted lookup?
- Which HTTP client abstraction best supports deterministic mocked tests in this repo?

## Research Conclusion

Phase 1 should implement a strict preflight intake pipeline with transparent normalization and canonical identity resolution. This directly satisfies `INPT-01` and `INPT-04` while producing durable contracts for later reliability and analysis phases.
