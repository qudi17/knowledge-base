# Stack Research

**Domain:** GitHub repository research automation skill (Codex/GSD ecosystem)
**Researched:** 2026-03-04
**Confidence:** MEDIUM-HIGH

## Recommended Stack

### Core Technologies

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| Node.js (LTS) | 22.x | Runtime for skill scripts, orchestration, and CLI execution | Strong async I/O model, mature ecosystem, good cross-platform behavior for long-running automation, and native `fetch`/`AbortController` support. |
| TypeScript | 5.8+ | Primary language for maintainable automation code | Improves reliability for multi-stage pipelines (crawl -> analyze -> synthesize -> report) through strict typing and safer refactors. |
| Octokit (`@octokit/rest` + plugins) | 21.x | GitHub API access (repos, trees, commits, code search metadata, rate limits) | Official GitHub client, stable auth/rate-limit handling, and lower integration risk than raw REST wrappers. |
| Markdown report pipeline (`remark` + `mdast`) | 15.x+ | Deterministic report generation with source-anchored evidence | AST-based generation is safer than ad-hoc string templates for large reports and repeatable formatting. |

### Supporting Libraries

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `p-queue` | 8.x | Concurrency and backpressure control for API calls and file analysis tasks | Use whenever processing many files/repositories to avoid rate-limit bursts and memory spikes. |
| `zod` | 3.x or 4.x | Runtime validation for intermediate research artifacts and final schema | Use for all boundary inputs/outputs (API payload transforms, step checkpoints, report sections). |
| `pino` | 9.x | Structured logs for unattended runs and progress visibility | Use in all long-running tasks to emit JSON logs and resumable progress markers. |
| `execa` | 9.x | Safe subprocess execution for optional local git workflows | Use when cloning/analyzing local mirrors or invoking git commands with timeout and stream capture. |
| `simple-git` | 3.x | Programmatic git metadata extraction | Use if local checkout analysis is needed (blame/commit/file history) without hand-written CLI parsing. |
| `retry` / `p-retry` | 6.x+ | Retry policies with exponential backoff | Use for transient failures (network, secondary rate limit, occasional 5xx). |
| `vitest` | 2.x | Unit/integration tests for pipeline behavior | Use for parser logic, prompt assembly, report schema checks, and retry/state transitions. |

### Development Tools

| Tool | Purpose | Notes |
|------|---------|-------|
| ESLint (flat config) | Static analysis and code quality | Enable strict TypeScript rules and no-floating-promises for async safety. |
| Prettier | Deterministic formatting | Keep generated markdown stable across commits; avoid noisy diffs. |
| `tsx` | Fast local TS execution | Ideal for script-driven development without full compile steps. |
| `pnpm` | Package management | Better workspace performance and lockfile determinism for automation projects. |

## Installation

```bash
# Core
pnpm add @octokit/rest @octokit/plugin-retry @octokit/plugin-throttling remark mdast-util-to-markdown

# Supporting
pnpm add p-queue zod pino execa simple-git p-retry

# Dev dependencies
pnpm add -D typescript vitest @types/node eslint @typescript-eslint/parser @typescript-eslint/eslint-plugin prettier tsx
```

## Alternatives Considered

| Recommended | Alternative | When to Use Alternative |
|-------------|-------------|-------------------------|
| Node.js + TypeScript | Python + Pydantic + PyGithub | Use Python if your team already standardizes on Python automation and has strong internal tooling there. |
| Octokit | Raw GitHub REST/GraphQL fetch layer | Use raw calls only if you need highly customized GraphQL query plans and want full transport control. |
| `remark` AST generation | String-template markdown writing | Use templates only for tiny fixed reports with minimal structure variance. |
| `pino` JSON logs | Console-only text logs | Use text logs only for very short single-repo experiments. |

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| JavaScript without strict typing for core pipeline | Increases silent schema drift and brittle refactors as report complexity grows | TypeScript strict mode + `zod` runtime validation |
| Naive `Promise.all` across large file/API sets | Causes bursty API failures, OOM risk, and poor recoverability | `p-queue` bounded concurrency with retry/backoff |
| Unpinned dependency ranges for core pipeline | Reproducibility issues across long unattended runs | Lockfile + conservative version pinning on critical packages |
| Markdown built entirely by string concatenation | Hard to maintain evidence traceability and section invariants | `remark`/MDAST-based structured generation |

## Stack Patterns by Variant

**If API-only analysis (no local clone):**
- Use Octokit + throttling/retry plugins + p-queue
- Because it minimizes disk usage and is easier to run in ephemeral CI environments

**If deep code-path and history analysis is required:**
- Add local clone flow via `execa`/`simple-git` and staged repository indexing
- Because commit-level and cross-file workflow inference is more accurate with local history/context

**If running overnight on many repositories:**
- Use checkpointed state files + resumable job IDs + structured logs
- Because unattended execution reliability matters more than single-run speed

## Version Compatibility

| Package A | Compatible With | Notes |
|-----------|-----------------|-------|
| `typescript@5.8+` | `@typescript-eslint/*@8.x` | Keep parser/plugin major versions aligned with TS support matrix. |
| `@octokit/rest@21.x` | `@octokit/plugin-retry@8.x`, `@octokit/plugin-throttling@11.x` | Compose plugins on the same major generation to avoid typing/runtime mismatch. |
| `vitest@2.x` | `node@20+` (recommended `22.x`) | Use Node LTS for stable ESM/test runtime behavior. |
| `pino@9.x` | modern Node LTS | Prefer transport-compatible logging setup in CI and local runs. |

## Sources

- Project context: `.planning/PROJECT.md` — requirements, constraints, and execution priorities
- Template: `/Users/eddy/.codex/get-shit-done/templates/research-project/STACK.md` — structure and required sections
- Maintainer inference (2026 baseline): recommendations prioritize reliability, traceability, and unattended execution tradeoffs for this domain

---
*Stack research for: GitHub repository research automation skill*
*Researched: 2026-03-04*
