# Pitfalls Research

**Domain:** Automated GitHub repository research and evidence-backed technical reporting
**Researched:** 2026-03-04
**Confidence:** HIGH

## Critical Pitfalls

### Pitfall 1: Hallucinated or weakly grounded conclusions

**What goes wrong:**
The report states strong architecture or workflow conclusions that are not actually supported by code-level evidence.

**Why it happens:**
Analysis favors summarization speed over source validation, or cites files without line-level traceability.

**How to avoid:**
Require every high-impact conclusion to include at least one code snippet and anchored GitHub link (file + line). Add a hard validation step that fails report generation when evidence is missing.

**Warning signs:**
Frequent phrases like "likely", "appears", "probably" with no linked proof; findings cannot be quickly verified by opening referenced lines.

**Phase to address:**
Phase 2 (Evidence model + citation enforcement)

---

### Pitfall 2: Superficial coverage of large repositories

**What goes wrong:**
The output looks complete but only covers top-level folders, missing core runtime paths, extension points, and hidden critical modules.

**Why it happens:**
Single-pass scanning and token/time pressure in large codebases; no deliberate core-first then full-coverage strategy.

**How to avoid:**
Implement staged analysis: (1) identify entrypoints/core workflow graph, (2) deep-dive core modules, (3) broaden coverage and merge. Track coverage counters (critical directories visited, workflow paths validated).

**Warning signs:**
Reports over-index on README/build files; missing discussion of actual execution path; no explicit "uncovered areas" section.

**Phase to address:**
Phase 3 (Core-first scanner + coverage accounting)

---

### Pitfall 3: Brittle unattended execution

**What goes wrong:**
Long-running jobs stall or fail and never recover, producing partial artifacts and no trustworthy completion state.

**Why it happens:**
No checkpointing, weak retry policy, poor transient-error handling, and missing resumable state machine.

**How to avoid:**
Add durable checkpoints per stage, classified retry policy (network/rate-limit/parse), resumable run IDs, and explicit terminal states (`SUCCEEDED`, `FAILED`, `PARTIAL_WITH_GAPS`).

**Warning signs:**
Repeated restarts from zero, inconsistent artifact sets, logs with repeated transient failures but no backoff behavior.

**Phase to address:**
Phase 1 (Execution orchestration + resilience)

---

### Pitfall 4: Non-reproducible evidence links

**What goes wrong:**
Findings reference moving branch heads only; links drift and can no longer prove conclusions later.

**Why it happens:**
Using only `main`/`master` URLs without commit-pinned references.

**How to avoid:**
Store both stable commit-SHA links and latest-branch links. Record repository revision metadata in report header and per-snippet citation.

**Warning signs:**
Previously valid links show different code than reported; reviewers cannot reproduce findings from saved report.

**Phase to address:**
Phase 2 (Citation schema + provenance metadata)

---

### Pitfall 5: Scope creep into code-change workflows

**What goes wrong:**
The system starts proposing or applying patches, adding risk and blurring trust boundary for a research-only v1.

**Why it happens:**
Feature pressure to "act on findings" before core research quality is stable.

**How to avoid:**
Enforce a strict read-only contract in architecture and tests. Gate any mutation capability behind a future milestone.

**Warning signs:**
Requirements/docs start mixing research output with remediation execution; write-capable integrations appear in v1 backlog.

**Phase to address:**
Phase 0 (Product boundary + acceptance criteria lock)

---

### Pitfall 6: Noise-heavy outputs that hide key decisions

**What goes wrong:**
Reports are long but low utility: too much inventory, not enough decision-ready conclusions.

**Why it happens:**
No output structure prioritizing conclusions and tradeoffs; evidence is dumped without synthesis.

**How to avoid:**
Use fixed report contract: conclusions first, then evidence, then gaps/uncertainty. Add quality checks for "decision-readiness".

**Warning signs:**
Readers must scan many pages before learning recommendations; repeated code excerpts with no implication analysis.

**Phase to address:**
Phase 4 (Report UX + synthesis quality checks)

## Technical Debt Patterns

Shortcuts that seem reasonable but create long-term problems.

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Skip line-anchored citations in early prototype | Faster initial output | Low trust, rework to retrofit provenance | Only in throwaway spike code |
| Treat full-repo scan as optional after core analysis | Shorter runtime | Persistent blind spots in less obvious modules | Only when explicitly flagged as partial report |
| Store run state only in memory | Simpler implementation | No resumability, fragile unattended runs | Never |
| Rely on default branch links only | Easy URL generation | Evidence drift and non-reproducibility | Never |
| Use ad-hoc Markdown rendering per run | Quick iteration | Inconsistent outputs, harder downstream automation | Only before report schema is frozen |

## Integration Gotchas

Common mistakes when connecting to external services.

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| GitHub API | Ignoring rate limits and abuse detection | Budget requests, backoff with jitter, and classify retryable failures |
| GitHub raw/content endpoints | Assuming uniform file fetch semantics | Normalize fetch path and fallback to clone/local parse when API limits hit |
| GitHub links in report | Linking only to branch HEAD | Emit both SHA-pinned and branch links for each citation |
| Local clone + parser tools | Parsing generated/vendor files as first-class code | Apply domain-aware ignore rules, then allow targeted opt-in |
| Logging/telemetry backend | Logging full source blobs | Log metadata and hashes, not sensitive/full code content |

## Performance Traps

Patterns that work at small scale but fail as usage grows.

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| Full-tree parsing before prioritization | Long startup, slow first insight | Core-first indexing and staged deep dives | Large monorepos (100k+ files or multi-GB history) |
| Re-analyzing unchanged files each run | Runtime/cost grows linearly across reruns | Cache by commit SHA + file hash and reuse findings | Frequent reruns on active repos |
| Single-threaded fetch + analysis pipeline | Idle CPU/network and long wall-clock | Bounded parallelism with queue-based backpressure | Repos with many medium files |
| Rendering giant report in one pass | Memory spikes, partial write failures | Stream section outputs and checkpoint artifacts | Multi-repo overnight batches |

## Security Mistakes

Domain-specific security issues beyond general web security.

| Mistake | Risk | Prevention |
|---------|------|------------|
| Indexing secrets in sampled code and storing raw excerpts | Credential leakage in artifacts/logs | Secret detection + redaction pipeline before persistence |
| Executing repository code during "analysis" | Remote code execution risk | Strict static analysis mode; no untrusted code execution |
| Persisting tokens in plaintext run logs | Account compromise | Use secure secret store and redact tokens in all logs |
| Cross-repo cache key collisions | Data leakage between analyses | Namespace caches by repo owner/name + commit identity |
| Treating private-repo assumptions as public defaults later | Accidental privacy regressions in v2 | Separate threat models and explicit auth/privacy design phase |

## UX Pitfalls

Common user experience mistakes in this domain.

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| No progress visibility in long runs | Users assume tool is hung and abort | Stage-based progress with ETA ranges and active module indicator |
| Evidence links hard to inspect | Users cannot trust findings quickly | Compact finding cards with direct line-anchored links |
| Missing uncertainty language | False confidence in recommendations | Include confidence and "what was not analyzed" per major conclusion |
| Single massive report artifact | Hard to navigate and reuse | Provide summary + deep-dive sections with stable anchors |

## "Looks Done But Isn't" Checklist

Things that appear complete but are missing critical pieces.

- [ ] **Evidence completeness:** Often missing line-level anchors — verify every key conclusion has snippet + URL + line.
- [ ] **Coverage completeness:** Often missing non-obvious core paths — verify explicit list of analyzed modules and excluded areas.
- [ ] **Resilience completeness:** Often missing checkpoint/retry proof — verify interrupted run can resume to terminal state.
- [ ] **Reproducibility completeness:** Often missing commit-pinned references — verify report includes repository SHA metadata.
- [ ] **Decision-readiness:** Often missing actionable recommendation framing — verify summary contains clear choices and tradeoffs.

## Recovery Strategies

When pitfalls occur despite prevention, how to recover.

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| Hallucinated conclusions | HIGH | Invalidate report version, rerun evidence validator, regenerate only from proven citations |
| Superficial large-repo coverage | MEDIUM | Re-run staged scanner with coverage thresholds, append gaps-to-close section |
| Unattended run collapse | MEDIUM | Resume from last checkpoint, apply transient-failure backoff profile, mark partials explicitly |
| Evidence drift from branch-only links | MEDIUM | Rebind all citations to analyzed commit SHA and republish report |
| Noise-heavy report | LOW | Re-synthesize to conclusion-first template and deduplicate repetitive evidence |

## Pitfall-to-Phase Mapping

How roadmap phases should address these pitfalls.

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| Hallucinated or weakly grounded conclusions | Phase 2: Evidence model + citation enforcement | CI check fails if key findings lack snippet + line-anchored source links |
| Superficial coverage of large repositories | Phase 3: Core-first scanner + coverage accounting | Coverage report includes core workflow path completion and explicit exclusions |
| Brittle unattended execution | Phase 1: Execution orchestration + resilience | Kill-and-resume test reaches valid terminal state without data loss |
| Non-reproducible evidence links | Phase 2: Citation schema + provenance metadata | Every citation includes commit SHA link plus latest-branch companion link |
| Scope creep into code-change workflows | Phase 0: Product boundary lock | Acceptance tests assert read-only behavior and deny mutation actions |
| Noise-heavy outputs that hide decisions | Phase 4: Report UX + synthesis checks | Reviewer can identify key recommendation and rationale in first section |

## Sources

- `.planning/PROJECT.md` project intent and constraints
- Known failure patterns from long-running static analysis/reporting systems
- Common GitHub API reliability and provenance issues in automation tooling

---
*Pitfalls research for: Automated GitHub project research and reporting*
*Researched: 2026-03-04*
