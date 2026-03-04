---
phase: 03
slug: search-based-repository-selection
status: draft
nyquist_compliant: true
wave_0_complete: false
created: 2026-03-04
---

# Phase 03 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest |
| **Config file** | package.json scripts / default vitest config |
| **Quick run command** | `npm exec --yes vitest run tests/intake/preflight.spec.ts tests/intake/github-client.spec.ts` |
| **Full suite command** | `npm exec --yes vitest run tests/intake/*.spec.ts tests/reliability/*.spec.ts tests/search/*.spec.ts` |
| **Estimated runtime** | ~30 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npm exec --yes vitest run tests/intake/preflight.spec.ts tests/intake/github-client.spec.ts`
- **After every plan wave:** Run `npm exec --yes vitest run tests/intake/*.spec.ts tests/reliability/*.spec.ts tests/search/*.spec.ts`
- **Before `$gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 03-01-01 | 01 | 1 | INPT-02 | unit | `npm exec --yes vitest run tests/search/search-client.spec.ts` | ❌ W0 | ⬜ pending |
| 03-01-02 | 01 | 1 | INPT-02 | unit | `npm exec --yes vitest run tests/search/search-service.spec.ts` | ❌ W0 | ⬜ pending |
| 03-02-01 | 02 | 2 | INPT-02 | integration | `npm exec --yes vitest run tests/search/selection-bridge.spec.ts` | ❌ W0 | ⬜ pending |
| 03-02-02 | 02 | 2 | INPT-02 | integration | `npm exec --yes vitest run tests/search/flow.spec.ts` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `tests/search/search-client.spec.ts` — search client contracts for INPT-02
- [ ] `tests/search/search-service.spec.ts` — retry/empty-state behavior coverage
- [ ] `tests/search/selection-bridge.spec.ts` — confirm-before-launch + preflight bridge
- [ ] `tests/search/flow.spec.ts` — end-to-end `search -> select -> confirm -> preflight`

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
