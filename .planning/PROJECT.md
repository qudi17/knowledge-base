# GitHub Project Research Skill

## What This Is

A Codex skill for deep, automated research of GitHub repositories, primarily for personal technical decision-making and reuse learning. It accepts repository targets, analyzes architecture and core workflows, and outputs standardized research documentation with evidence. The workflow is designed for unattended execution (including overnight runs) with retry and progress logging.

## Core Value

Produce decision-ready, deeply traceable GitHub project research reports with clear conclusions backed by source-linked code evidence.

## Requirements

### Validated

(None yet — ship to validate)

### Active

- [ ] Automatically analyze public GitHub repositories end-to-end and generate a standardized Markdown report.
- [ ] Identify core modules and end-to-end workflows, including cross-module flow diagrams.
- [ ] For key findings, include code snippets with GitHub source links and line anchors for traceability.
- [ ] Run fully unattended with immediate execution trigger, staged progress logs, auto-retry, and completion-focused behavior.
- [ ] Prioritize core analysis first, then expand to full-repo coverage; prefer deep and comprehensive output quality.
- [ ] Support multiple input modes over time (direct repo URL first, then search-based and local-repo inputs).

### Out of Scope

- Automatic code modification or auto-submitted patches to analyzed repositories — v1 is research-only.
- Private repository authentication workflows — initial version targets public repositories first.

## Context

The user wants a skill specifically for researching GitHub projects, with personal usage as top priority, then team reuse. Research depth must be as complete as practical, with explicit evidence traceability (file + line links) to enable quick source verification. Reports should be conclusion-first, then evidence, and include both stable (commit SHA) and latest-branch references where possible. For large repositories, the preferred strategy is staged scanning and merged synthesis; execution should tolerate failures through automatic retries and continue until completion.

## Constraints

- **Execution Mode**: Fully automated, unattended runs — Must support long-running tasks and resilient recovery.
- **Output Format**: Standardized local Markdown report — Must be readable and reusable across runs.
- **Evidence Quality**: Function/method-level snippets with source anchors — Enables auditability of conclusions.
- **Analysis Strategy**: Core-first then full coverage — Balances early value with eventual completeness.
- **Coverage Boundaries**: Skip typical build artifacts by default — Reduce noise while preserving code insight quality.
- **Cost/Latency**: Quality-first preference — Accept longer runtime for deeper analysis.

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| v1 should be research-only (no auto code changes) | Keep scope focused on high-value analysis and trustable output | — Pending |
| Default trigger is immediate on-demand execution | Matches user correction and expected control flow | — Pending |
| Report style is conclusion-first, then evidence | Speeds decision-making while preserving technical depth | — Pending |
| Evidence should include rich source anchoring | User requires quick jump from finding to exact code location | — Pending |
| Large repo handling uses phased scan + merged report | Improves reliability for very large codebases | — Pending |

---
*Last updated: 2026-03-04 after initialization*
