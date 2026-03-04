---
phase: 02
slug: unattended-execution-reliability
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-04
---

# Phase 02 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest |
| **Config file** | none - Wave 0 installs |
| **Quick run command** | `npm exec --yes vitest run tests/reliability/state-machine.spec.ts tests/reliability/retry-policy.spec.ts` |
| **Full suite command** | `npm exec --yes vitest run tests/reliability/*.spec.ts tests/reliability/**/*.spec.ts` |
| **Estimated runtime** | ~60 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npm exec --yes vitest run tests/reliability/state-machine.spec.ts tests/reliability/retry-policy.spec.ts`
- **After every plan wave:** Run `npm exec --yes vitest run tests/reliability/*.spec.ts tests/reliability/**/*.spec.ts`
- **Before `$gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 60 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 02-01-01 | 01 | 1 | RELY-01 | unit | `npm exec --yes vitest run tests/reliability/state-machine.spec.ts` | ❌ W0 | ⬜ pending |
| 02-01-02 | 01 | 1 | RELY-03 | unit | `npm exec --yes vitest run tests/reliability/retry-policy.spec.ts` | ❌ W0 | ⬜ pending |
| 02-02-01 | 02 | 2 | RELY-04 | integration | `npm exec --yes vitest run tests/reliability/checkpoint-resume.spec.ts` | ❌ W0 | ⬜ pending |
| 02-02-02 | 02 | 2 | RELY-02, RELY-05 | integration | `npm exec --yes vitest run tests/reliability/orchestrator.spec.ts tests/reliability/progress-reporter.spec.ts` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `tests/reliability/state-machine.spec.ts` - transition + terminal guard stubs for RELY-01
- [ ] `tests/reliability/retry-policy.spec.ts` - transient/permission-rate-limit/retry-budget stubs for RELY-03
- [ ] `tests/reliability/checkpoint-resume.spec.ts` - checkpoint schema + resume conflict stubs for RELY-04
- [ ] `tests/reliability/orchestrator.spec.ts` - completion-seeking run lifecycle stubs for RELY-05
- [ ] `tests/reliability/progress-reporter.spec.ts` - stage cadence and pinned failure summary stubs for RELY-02

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Final summary readability for overnight runs | RELY-02, RELY-05 | Clarity/actionability quality is subjective | Execute a simulated failed-and-recovered run and review summary ordering (conclusion first, high-priority failures pinned) |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 60s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
