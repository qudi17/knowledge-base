---
phase: 05
slug: core-architecture-and-workflow-analysis
status: draft
nyquist_compliant: true
wave_0_complete: false
created: 2026-03-04
---

# Phase 05 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest |
| **Config file** | package.json scripts / default vitest config |
| **Quick run command** | `npm exec --yes vitest run tests/analysis/contracts.spec.ts tests/analysis/core-scoring.spec.ts tests/analysis/module-boundary.spec.ts` |
| **Full suite command** | `npm exec --yes vitest run tests/analysis/*.spec.ts tests/intake/*.spec.ts tests/reliability/*.spec.ts tests/search/*.spec.ts` |
| **Estimated runtime** | ~40 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npm exec --yes vitest run tests/analysis/contracts.spec.ts tests/analysis/core-scoring.spec.ts tests/analysis/module-boundary.spec.ts`
- **After every plan wave:** Run `npm exec --yes vitest run tests/analysis/*.spec.ts tests/intake/*.spec.ts tests/reliability/*.spec.ts tests/search/*.spec.ts`
- **Before `$gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 40 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 05-01-01 | 01 | 1 | ANLY-01 | unit | `npm exec --yes vitest run tests/analysis/contracts.spec.ts` | ❌ W0 | ⬜ pending |
| 05-01-02 | 01 | 1 | ANLY-01 | unit | `npm exec --yes vitest run tests/analysis/core-scoring.spec.ts` | ❌ W0 | ⬜ pending |
| 05-01-03 | 01 | 1 | ANLY-01 | unit | `npm exec --yes vitest run tests/analysis/contracts.spec.ts tests/analysis/core-scoring.spec.ts` | ❌ W0 | ⬜ pending |
| 05-02-01 | 02 | 2 | ANLY-02 | integration | `npm exec --yes vitest run tests/analysis/workflow-reconstruction.spec.ts` | ❌ W0 | ⬜ pending |
| 05-02-02 | 02 | 2 | ANLY-03 | integration | `npm exec --yes vitest run tests/analysis/core-first-sequencer.spec.ts` | ❌ W0 | ⬜ pending |
| 05-02-03 | 02 | 2 | ANLY-03 | integration | `npm exec --yes vitest run tests/analysis/core-first-sequencer.spec.ts tests/reliability/orchestrator.spec.ts` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `tests/analysis/contracts.spec.ts` — contracts/artifact schema stability for core modules + workflows
- [ ] `tests/analysis/core-scoring.spec.ts` — weighted scoring, tie-break, threshold, and top-5 overlap stability checks
- [ ] `tests/analysis/module-boundary.spec.ts` — module boundary extraction and alias merge behavior
- [ ] `tests/analysis/workflow-reconstruction.spec.ts` — cross-module mainline + key exception-node reconstruction checks
- [ ] `tests/analysis/core-first-sequencer.spec.ts` — stage ordering, stop conditions, budget handling, and snapshot freeze checks

---

## Manual-Only Verifications

All phase behaviors have automated verification.

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 40s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** approved 2026-03-04
