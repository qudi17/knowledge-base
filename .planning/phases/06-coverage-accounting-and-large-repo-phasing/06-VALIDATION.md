---
phase: 06
slug: coverage-accounting-and-large-repo-phasing
status: draft
nyquist_compliant: true
wave_0_complete: false
created: 2026-03-04
---

# Phase 06 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest |
| **Config file** | package.json scripts / default vitest config |
| **Quick run command** | `npm exec --yes vitest run tests/analysis/coverage-manifest.spec.ts tests/analysis/phase-planner.spec.ts` |
| **Full suite command** | `npm exec --yes vitest run tests/analysis/*.spec.ts tests/reliability/*.spec.ts tests/search/*.spec.ts tests/intake/*.spec.ts` |
| **Estimated runtime** | ~60 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npm exec --yes vitest run tests/analysis/coverage-manifest.spec.ts tests/analysis/phase-planner.spec.ts`
- **After every plan wave:** Run `npm exec --yes vitest run tests/analysis/*.spec.ts tests/reliability/*.spec.ts tests/search/*.spec.ts tests/intake/*.spec.ts`
- **Before `$gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 60 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 06-01-01 | 01 | 1 | ANLY-04 | unit | `npm exec --yes vitest run tests/analysis/coverage-contracts.spec.ts` | ❌ W0 | ⬜ pending |
| 06-01-02 | 01 | 1 | ANLY-04 | integration | `npm exec --yes vitest run tests/analysis/coverage-manifest.spec.ts` | ❌ W0 | ⬜ pending |
| 06-01-03 | 01 | 1 | ANLY-04 | integration | `npm exec --yes vitest run tests/analysis/coverage-summary.spec.ts` | ❌ W0 | ⬜ pending |
| 06-02-01 | 02 | 2 | ANLY-05 | unit | `npm exec --yes vitest run tests/analysis/phase-planner.spec.ts` | ❌ W0 | ⬜ pending |
| 06-02-02 | 02 | 2 | ANLY-05 | integration | `npm exec --yes vitest run tests/analysis/phased-execution.spec.ts tests/reliability/orchestrator.spec.ts` | ❌ W0 | ⬜ pending |
| 06-02-03 | 02 | 2 | ANLY-05 | integration | `npm exec --yes vitest run tests/analysis/merge-coherence.spec.ts tests/analysis/phased-execution.spec.ts` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `tests/analysis/coverage-contracts.spec.ts` — contract/invariant checks for coverage manifest, gaps, and merge records
- [ ] `tests/analysis/coverage-manifest.spec.ts` — scope inventory, exclusion policy, unresolved-to-gap enforcement
- [ ] `tests/analysis/coverage-summary.spec.ts` — module+file accounting, H/M/L tiering, known-gap grouping
- [ ] `tests/analysis/phase-planner.spec.ts` — large-repo trigger, deterministic partitioning, adaptive chunk sizing
- [ ] `tests/analysis/phased-execution.spec.ts` — sub-phase lifecycle, continue-on-safe-failure, resume from checkpoint
- [ ] `tests/analysis/merge-coherence.spec.ts` — dedupe, conflict preservation, adjudication rationale, dual coverage statements

---

## Manual-Only Verifications

All phase behaviors have automated verification.

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 60s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** approved 2026-03-04
