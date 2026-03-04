---
phase: 04
slug: local-repository-input
status: draft
nyquist_compliant: true
wave_0_complete: false
created: 2026-03-04
---

# Phase 04 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest |
| **Config file** | package.json scripts / default vitest config |
| **Quick run command** | `npm exec --yes vitest run tests/intake/local-preflight.spec.ts` |
| **Full suite command** | `npm exec --yes vitest run tests/intake/*.spec.ts tests/reliability/*.spec.ts tests/search/*.spec.ts` |
| **Estimated runtime** | ~30 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npm exec --yes vitest run tests/intake/local-preflight.spec.ts`
- **After every plan wave:** Run `npm exec --yes vitest run tests/intake/*.spec.ts tests/reliability/*.spec.ts tests/search/*.spec.ts`
- **Before `$gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 04-01-01 | 01 | 1 | INPT-03 | unit | `npm exec --yes vitest run tests/intake/local-preflight.spec.ts` | ❌ W0 | ⬜ pending |
| 04-01-02 | 01 | 1 | INPT-03 | unit | `npm exec --yes vitest run tests/intake/local-preflight.spec.ts tests/intake/preflight.spec.ts` | ❌ W0 | ⬜ pending |
| 04-02-01 | 02 | 2 | INPT-03 | integration | `npm exec --yes vitest run tests/reliability/local-input-reliability.spec.ts` | ❌ W0 | ⬜ pending |
| 04-02-02 | 02 | 2 | INPT-03 | integration | `npm exec --yes vitest run tests/reliability/local-input-reliability.spec.ts tests/intake/preflight.spec.ts` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `tests/intake/local-preflight.spec.ts` — local path parse/normalize/validate/root/branch/canonical fallback coverage
- [ ] `tests/reliability/local-input-reliability.spec.ts` — deterministic local failure and successful local-run progression
- [ ] Extend `tests/intake/preflight.spec.ts` for no-regression coverage across URL/search/local modes

---

## Manual-Only Verifications

All phase behaviors have automated verification.

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 30s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** approved 2026-03-04
