---
phase: 01
slug: repository-intake-foundation
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-04
---

# Phase 01 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest |
| **Config file** | none - Wave 0 installs |
| **Smoke command** | `npm exec --yes vitest run tests/intake/parser-normalizer.spec.ts` |
| **Quick run command** | `npm exec --yes vitest run tests/intake/parser-normalizer.spec.ts tests/intake/validator.spec.ts` |
| **Full suite command** | `npm exec --yes vitest run tests/intake/*.spec.ts tests/intake/**/*.spec.ts` |
| **Estimated runtime** | ~45 seconds |

---

## Sampling Rate

- **After every task commit:** Run smoke command (or fallback grep checks when vitest unavailable)
- **After every 2 task commits:** Run quick command
- **After every plan wave:** Run full suite command
- **Before `$gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 30 seconds (smoke), 60 seconds (quick)

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 01-01-01 | 01 | 1 | INPT-01 | unit | `npm exec --yes vitest run tests/intake/parser-normalizer.spec.ts` | ✅ | ⬜ pending |
| 01-01-02 | 01 | 1 | INPT-01 | unit | `npm exec --yes vitest run tests/intake/validator.spec.ts` | ✅ | ⬜ pending |
| 01-02-01 | 02 | 1 | INPT-04 | contract | `npm exec --yes vitest run tests/intake/github-client.spec.ts` | ✅ | ⬜ pending |
| 01-02-02 | 02 | 1 | INPT-04 | contract | `npm exec --yes vitest run tests/intake/github-client.spec.ts` | ✅ | ⬜ pending |
| 01-03-01 | 03 | 2 | INPT-01, INPT-04 | integration | `npm exec --yes vitest run tests/intake/preflight.spec.ts` | ✅ | ⬜ pending |
| 01-04-01 | 04 | 3 | INPT-01, INPT-04 | gap_closure | `npm exec --yes vitest run tests/intake/preflight.spec.ts || rg -n "not found|private|transient|rename|transfer|order" tests/intake/preflight.spec.ts` | ✅ | ⬜ pending |
| 01-04-02 | 04 | 3 | INPT-04 | gap_closure | `npm exec --yes vitest run tests/intake/github-client.spec.ts || rg -n "retry|attempt|max|TRANSIENT_ERROR" tests/intake/github-client.spec.ts` | ✅ | ⬜ pending |
| 01-04-03 | 04 | 3 | INPT-01, INPT-04 | gap_closure | `test -f .planning/phases/01-repository-intake-foundation/01-VALIDATION.md && rg -n "gap|closure|npm exec|node -v|npm -v|preflight\.spec|github-client\.spec" .planning/phases/01-repository-intake-foundation/01-VALIDATION.md` | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Gap Closure Command Profile

Use this profile when `pnpm` is unavailable and running `$gsd-execute-phase 1 --gaps-only`:

- `test -f tests/intake/preflight.spec.ts && test -f tests/intake/github-client.spec.ts`
- `rg -n "not found|private|transient|rename|transfer|order" tests/intake/preflight.spec.ts`
- `rg -n "retry|attempt|max|TRANSIENT_ERROR" tests/intake/github-client.spec.ts`
- `node -v && npm -v`
- Optional: `npm exec --yes vitest run tests/intake/github-client.spec.ts tests/intake/preflight.spec.ts`

This profile directly addresses the prior verification gap about environment-fragile `pnpm` commands.

---

## Wave 0 Requirements

- [ ] `tests/intake/parser-normalizer.spec.ts` - stubs for INPT-01 URL forms
- [ ] `tests/intake/validator.spec.ts` - host/policy checks
- [ ] `tests/intake/github-client.spec.ts` - canonical + retry + classification checks
- [ ] `tests/intake/preflight.spec.ts` - ordered pipeline and gap scenarios
- [ ] `npm exec --yes vitest --version` succeeds (or documented fallback profile applied)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Error summary wording clarity for unsupported/private repos | INPT-04 | Human readability and actionability are subjective | Run unsupported/private preflight cases and review `summary` text for actionable guidance |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: >=2 of each 3 consecutive implementation tasks include `<automated>`
- [ ] Wave 0 or fallback profile covers all execution-critical checks
- [ ] No watch-mode flags
- [ ] Feedback latency < 60s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
