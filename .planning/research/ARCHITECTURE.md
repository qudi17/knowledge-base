# Architecture Research

**Domain:** GitHub repository research automation (Codex skill)
**Researched:** 2026-03-04
**Confidence:** HIGH

## Standard Architecture

### System Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    Interface / Orchestration               │
├─────────────────────────────────────────────────────────────┤
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────┐  │
│  │ Skill Entry  │  │ Run Manager  │  │ Progress Logger  │  │
│  └──────┬───────┘  └──────┬───────┘  └────────┬─────────┘  │
│         │                 │                   │            │
├─────────┴─────────────────┴───────────────────┴────────────┤
│                   Research Processing Layer                 │
├─────────────────────────────────────────────────────────────┤
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────┐  │
│  │ Repo Intake  │→ │ Analyzer     │→ │ Evidence Builder │  │
│  └──────────────┘  └──────────────┘  └─────────┬────────┘  │
│                                                  │          │
│                               ┌──────────────────▼───────┐  │
│                               │ Report Synthesizer       │  │
│                               └──────────────────────────┘  │
├─────────────────────────────────────────────────────────────┤
│                   Storage / Artifact Layer                  │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────┐  │
│  │ Local Cache  │  │ Run State    │  │ Markdown Reports │  │
│  └──────────────┘  └──────────────┘  └──────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

### Component Responsibilities

| Component | Responsibility | Typical Implementation |
|-----------|----------------|------------------------|
| Skill Entry | Accept input target and initialize run | `SKILL.md` command contract + launcher script |
| Run Manager | Control staged execution, retry, and completion state | Orchestrator module with step machine and checkpoints |
| Repo Intake | Resolve GitHub source and fetch/index code | Git clone/shallow fetch + file manifest/index builder |
| Analyzer | Detect architecture, modules, and key workflows | Multi-pass static analysis + heuristic ranking |
| Evidence Builder | Produce source-anchored findings with line references | Snippet extractor + permalink formatter |
| Report Synthesizer | Convert findings into conclusion-first markdown | Template-driven renderer |
| Progress Logger | Emit stage-based progress updates for unattended runs | Structured logs with timestamps and stage IDs |
| Run State Store | Persist retries and partial progress for recovery | JSON state files in workspace |
| Markdown Reports | Final research artifacts for reuse | `.planning/research/*.md` output |

## Recommended Project Structure

```
skill/
├── entry/                  # command entrypoints and user input parsing
│   └── run.ts              # starts research run and validates arguments
├── orchestration/          # sequencing, retries, recovery logic
│   ├── pipeline.ts         # stage graph and run transitions
│   └── state.ts            # checkpoint persistence helpers
├── intake/                 # repository discovery and local indexing
│   ├── fetch.ts            # GitHub fetch/clone operations
│   └── manifest.ts         # source file inventory and filtering
├── analysis/               # deep code understanding
│   ├── modules.ts          # component and boundary extraction
│   ├── workflows.ts        # e2e workflow reconstruction
│   └── quality.ts          # confidence scoring and gap detection
├── evidence/               # traceable citations/snippets
│   ├── snippets.ts         # short, relevant code snippet extraction
│   └── links.ts            # line-anchored GitHub link generation
├── reporting/              # markdown generation
│   ├── templates/          # report template assets
│   └── synthesize.ts       # conclusion + evidence assembly
├── logging/                # progress and diagnostics
│   └── progress.ts         # stage log writer
└── output/                 # generated artifacts
```

### Structure Rationale

- **`orchestration/`:** keeps retry/recovery logic isolated so analysis modules stay deterministic and testable.
- **`analysis/` and `evidence/`:** separates interpretation from citation generation, preventing untraceable claims.
- **`reporting/`:** centralizes output format, enabling consistent report quality across projects.
- **`output/`:** makes artifacts explicit and easy to version or archive.

## Architectural Patterns

### Pattern 1: Staged Pipeline with Checkpoints

**What:** Process work in deterministic stages (intake → analysis → evidence → synthesis), persisting state after each stage.
**When to use:** Long-running unattended tasks where partial failure must not force full reruns.
**Trade-offs:** Slight overhead in state modeling; major gain in resilience and restart speed.

**Example:**
```typescript
for (const stage of pipeline) {
  if (state.isCompleted(stage.id)) continue;
  await stage.run(context);
  await state.markCompleted(stage.id);
}
```

### Pattern 2: Analysis/Evidence Split

**What:** Keep finding generation independent from source-link formatting.
**When to use:** Any workflow requiring auditable, source-backed conclusions.
**Trade-offs:** More interfaces between modules; clearer correctness boundaries.

**Example:**
```typescript
const findings = await analyzeRepository(index);
const citations = await buildEvidence(findings, index);
```

### Pattern 3: Conclusion-First Rendering

**What:** Emit key outcomes first, then supporting evidence blocks.
**When to use:** Decision-support documents consumed by humans under time pressure.
**Trade-offs:** Requires ranking confidence/importance before writing; much better readability.

## Data Flow

### Request Flow

```
[User provides repo target]
    ↓
[Skill Entry] → [Run Manager] → [Repo Intake] → [Analyzer]
    ↓               ↓               ↓              ↓
[Progress logs]  [Retry policy]  [Index/cache]  [Findings]
    ↓
[Evidence Builder] → [Report Synthesizer] → [.planning/research/*.md]
```

### State Management

```
[Run State Store]
    ↓ (load checkpoint)
[Stage Executor] → [Stage Result] → [Persist checkpoint]
    ↓
[Resume from failed/interrupted stage]
```

### Key Data Flows

1. **Repository Intake Flow:** input repo URL → normalized target → local source/index manifest.
2. **Analysis Flow:** manifest → module/workflow findings → confidence scoring.
3. **Evidence Flow:** findings → snippet extraction + line anchors → citation bundle.
4. **Synthesis Flow:** findings + citations + template → standardized markdown report.

## Build Order Implications

1. **Build orchestration and state first:** retries/checkpoints define execution contracts for every downstream module.
2. **Implement intake before deep analysis:** analyzer quality depends on stable file filtering and manifest structure.
3. **Add evidence generation before final reporting:** report format should depend on citation objects, not raw analyzer output.
4. **Finalize templates after pipeline outputs stabilize:** prevents frequent template churn during early module iteration.
5. **Introduce scale optimizations last:** parallel scanning and advanced heuristics should follow correctness and traceability.

## Scaling Considerations

| Scale | Architecture Adjustments |
|-------|--------------------------|
| 0-20 repos/day | Single-process pipeline with local cache and serial stages |
| 20-500 repos/day | Parallelize per-stage workers; deduplicate cache across runs |
| 500+ repos/day | Distributed job queue for intake/analysis; centralized artifact store |

### Scaling Priorities

1. **First bottleneck:** repository scan latency; optimize with incremental indexing and file-type filtering.
2. **Second bottleneck:** synthesis quality vs speed; cache intermediate findings and parallelize evidence extraction.

## Anti-Patterns

### Anti-Pattern 1: One-Pass Mega Prompting

**What people do:** Feed entire repositories directly into one analysis step.
**Why it's wrong:** loses structure, weakens traceability, and fails on large repos.
**Do this instead:** staged analysis with module-level passes and merged synthesis.

### Anti-Pattern 2: Claim-Only Reporting

**What people do:** publish conclusions without code-level anchors.
**Why it's wrong:** impossible to audit, low trust for technical decisions.
**Do this instead:** require snippet + line-linked source evidence for each key finding.

## Integration Points

### External Services

| Service | Integration Pattern | Notes |
|---------|---------------------|-------|
| GitHub (public repos) | Clone/fetch + permalink generation | Prefer commit-SHA links for stable references |
| Local filesystem | Structured artifact writes | Keep reports and run state separate |

### Internal Boundaries

| Boundary | Communication | Notes |
|----------|---------------|-------|
| Orchestration ↔ Intake | Typed stage input/output contracts | Intake errors should be retry-aware |
| Analysis ↔ Evidence | Finding schema (IDs, file refs, spans) | Enforces citation completeness |
| Evidence ↔ Reporting | Citation bundle objects | Prevents report generation without traceability |

## Sources

- `.planning/PROJECT.md`
- `/Users/eddy/.codex/get-shit-done/templates/research-project/ARCHITECTURE.md`

---
*Architecture research for: GitHub repository research automation*
*Researched: 2026-03-04*
