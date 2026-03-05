---
name: github-researcher
description: Find practical implementation ideas and reusable code from GitHub repositories without requiring full-project adoption. Use when asked to research how a feature is implemented, extract patterns from projects (for example Agent TOC designs like openManus), compare candidate approaches, or produce a minimal reuse plan with concrete files/functions to adapt.
---

# GitHub Researcher

## Overview

Produce fast, evidence-based solution research from GitHub with emphasis on:
- idea extraction (how others solve the same problem)
- partial reuse (which files/functions can be adapted directly)
- low-friction integration (minimal dependency and migration cost)

## Workflow

1. Clarify research target
- Identify feature goal, current stack, hard constraints, and preferred reuse depth:
  - `idea-only`
  - `partial-code-reuse`
  - `drop-in module`

2. Triage repositories for relevance
- Prioritize repositories by problem match first, popularity second.
- For each candidate, locate where the target feature lives:
  - architecture docs and README sections
  - folder names matching feature terms
  - key interfaces/classes/functions implementing the behavior

3. Extract reusable patterns and code units
- Build a feature map:
  - input/output contract
  - control flow and orchestration
  - extension hooks
- Identify reusable units with exact paths and reuse type:
  - `copy-adapt`: copy then refactor for local conventions
  - `wrap`: call existing module behind adapter layer
  - `reimplement`: preserve design, rewrite code

4. Evaluate integration risk
- Use `references/rubric.md` with higher weight on integration complexity and dependency drag.
- Always check license compatibility before recommending code reuse.

5. Deliver implementation-focused output
- Use `references/report-template.md`.
- Provide:
  - recommended approach
  - top candidate code paths
  - minimal adaptation steps
  - fallback option if direct reuse fails

## Comparison Mode (Idea Mining)

When comparing repositories for a feature:
- Score each repo with `references/rubric.md`.
- Rank by `problem-fit + reusability + integration cost`.
- Recommend one primary source and one backup source.

## Quality Bar

- Cite concrete evidence (file path, symbol/function name, issue/PR link when relevant).
- Mark uncertain claims as assumptions.
- Avoid stars-driven conclusions.
- Prefer "insufficient evidence" over speculation when data is missing.

## Typical Triggers

- "帮我研究这个 GitHub 项目，重点看能不能复用其中一部分代码。"
- "我不想引入整个项目，只想借鉴实现思路，给我最小可落地方案。"
- "在 Agent TOC 方向参考 openManus，帮我找可复用模块和改造步骤。"

## Resources

- `references/rubric.md`: Scoring for fit, reusability, and integration risk.
- `references/report-template.md`: Output format for idea extraction and code reuse plan.
