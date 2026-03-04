---
phase: 07
slug: evidence-and-citation-guarantees
status: draft
nyquist_compliant: true
wave_0_complete: false
created: 2026-03-04
---

# Phase 07 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest |
| **Config file** | package.json scripts / default vitest config |
| **Quick run command** | `npm exec --yes vitest run tests/analysis/evidence-contracts.spec.ts tests/analysis/citation-builder.spec.ts` |
| **Full suite command** | `npm exec --yes vitest run tests/analysis/*.spec.ts tests/reliability/*.spec.ts tests/intake/*.spec.ts tests/search/*.spec.ts` |
| **Estimated runtime** | ~70 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npm exec --yes vitest run tests/analysis/evidence-contracts.spec.ts tests/analysis/citation-builder.spec.ts`
- **After every plan wave:** Run `npm exec --yes vitest run tests/analysis/*.spec.ts tests/reliability/*.spec.ts tests/intake/*.spec.ts tests/search/*.spec.ts`
- **Before `$gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 70 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 07-01-01 | 01 | 1 | EVID-01, EVID-02 | unit | `npm exec --yes vitest run tests/analysis/evidence-contracts.spec.ts` | ❌ W0 | ⬜ pending |
| 07-01-02 | 01 | 1 | EVID-02, EVID-04 | unit | `npm exec --yes vitest run tests/analysis/citation-builder.spec.ts` | ❌ W0 | ⬜ pending |
| 07-01-03 | 01 | 1 | EVID-03 | integration | `npm exec --yes vitest run tests/analysis/snippet-policy.spec.ts` | ❌ W0 | ⬜ pending |
| 07-02-01 | 02 | 2 | EVID-01, EVID-03, EVID-04 | integration | `npm exec --yes vitest run tests/analysis/evidence-runtime-integration.spec.ts` | ❌ W0 | ⬜ pending |
| 07-02-02 | 02 | 2 | EVID-02, EVID-04 | integration | `npm exec --yes vitest run tests/analysis/evidence-revalidation.spec.ts tests/reliability/orchestrator.spec.ts` | ❌ W0 | ⬜ pending |
| 07-02-03 | 02 | 2 | EVID-01..04 | integration | `npm exec --yes vitest run tests/analysis/evidence-runtime-integration.spec.ts tests/analysis/evidence-revalidation.spec.ts tests/reliability/orchestrator.spec.ts` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `tests/analysis/evidence-contracts.spec.ts` — evidence/citation schema invariants and stable ID contracts
- [ ] `tests/analysis/citation-builder.spec.ts` — SHA+default dual-link generation, line anchors, normalization and ordering
- [ ] `tests/analysis/snippet-policy.spec.ts` — function-level extraction, branch/exception enforcement, segmentation behavior
- [ ] `tests/analysis/evidence-runtime-integration.spec.ts` — end-to-end evidence emission across runtime pipeline
- [ ] `tests/analysis/evidence-revalidation.spec.ts` — stale-link detection, impacted-only revalidation, bounded budget/backlog behavior

---

## Manual-Only Verifications

All phase behaviors have automated verification.

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 70s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** approved 2026-03-04
