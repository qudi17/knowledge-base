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
| **Smoke command** | `pnpm vitest run tests/intake/parser-normalizer.spec.ts` |
| **Quick run command** | `pnpm vitest run tests/intake/parser-normalizer.spec.ts tests/intake/validator.spec.ts` |
| **Full suite command** | `pnpm vitest run tests/intake/*.spec.ts tests/intake/**/*.spec.ts` |
| **Estimated runtime** | ~45 seconds |

---

## Sampling Rate

- **After every task commit:** Run smoke `pnpm vitest run tests/intake/parser-normalizer.spec.ts`
- **After every 2 task commits (or task boundary with validator/client changes):** Run quick `pnpm vitest run tests/intake/parser-normalizer.spec.ts tests/intake/validator.spec.ts`
- **After every plan wave:** Run `pnpm vitest run tests/intake/*.spec.ts tests/intake/**/*.spec.ts`
- **Before `$gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 30 seconds (smoke), 60 seconds (quick)

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 01-01-01 | 01 | 1 | INPT-01 | unit | `pnpm vitest run tests/intake/parser-normalizer.spec.ts` | ❌ W0 | ⬜ pending |
| 01-01-02 | 01 | 1 | INPT-01 | unit | `pnpm vitest run tests/intake/validator.spec.ts` | ❌ W0 | ⬜ pending |
| 01-02-01 | 02 | 2 | INPT-04 | integration | `pnpm vitest run tests/intake/github-client.spec.ts` | ❌ W0 | ⬜ pending |
| 01-02-02 | 02 | 2 | INPT-04 | integration | `pnpm vitest run tests/intake/preflight.spec.ts` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `tests/intake/parser-normalizer.spec.ts` - stubs for INPT-01 URL forms
- [ ] `tests/intake/validator.spec.ts` - host/policy/typo handling checks
- [ ] `tests/intake/github-client.spec.ts` - canonical + default branch + classification checks
- [ ] `tests/intake/preflight.spec.ts` - ordered pipeline and final contract checks
- [ ] `pnpm add -D vitest` - framework install if missing

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Error summary wording clarity for unsupported/private repos | INPT-04 | Human readability and actionability are subjective | Run one unsupported/private preflight case and review summary text for clear next steps |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: >=2 of each 3 consecutive implementation tasks include `<automated>`
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 60s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
