# Feature Research

**Domain:** GitHub repository research automation (developer productivity)
**Researched:** 2026-03-04
**Confidence:** MEDIUM

## Feature Landscape

### Table Stakes (Users Expect These)

Features users assume exist. Missing these = product feels incomplete.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Direct GitHub repo URL input | Fast, explicit target selection is baseline for repo analysis tools | LOW | v1 primary entry path; validate URL and normalize owner/repo |
| Structured Markdown output report | Research tools are judged by output usability and readability | MEDIUM | Standardized sections and stable formatting for reuse |
| Architecture + workflow mapping | Users expect more than file listing; they need system understanding | HIGH | Cross-module flow extraction and synthesis required |
| Source-linked evidence with file/line anchors | Trust depends on verifiable claims | MEDIUM | Include clickable GitHub links with line anchors |
| Unattended long-run execution with progress logs | Large repos require asynchronous, durable runs | HIGH | Stage progress, resume/retry on transient failures |
| Core-first analysis strategy | Early value is expected before full sweep finishes | MEDIUM | Prioritize critical modules/workflows, then broaden coverage |

### Differentiators (Competitive Advantage)

Features that set the product apart. Not required, but valuable.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Conclusion-first report narrative | Speeds decisions before deep-dive reading | MEDIUM | Put recommendations/findings before detailed evidence blocks |
| Dual reference style (stable commit + latest branch) | Balances reproducibility and current relevance | MEDIUM | Emit both SHA-pinned and branch links where possible |
| Function/method-level snippet extraction for key findings | Increases precision and auditability beyond coarse file references | HIGH | Requires robust snippet boundary detection and de-duplication |
| Full-run completion bias with automatic retry loops | Increases reliability for overnight unattended usage | HIGH | Explicit retry policy, partial checkpointing, continuation logic |
| Scaled analysis mode for very large repos (phased scan + merged synthesis) | Maintains depth while handling size/complexity | HIGH | Chunk scan results and merge into one coherent report |

### Anti-Features (Commonly Requested, Often Problematic)

Features that seem good but create problems.

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| Automatic code patch generation in target repos | “If you found issues, just fix them” | Scope explosion, safety/risk, trust and ownership concerns for v1 | Keep v1 research-only; provide actionable recommendations and references |
| Private-repo auth + enterprise connectors in v1 | Teams often want immediate internal-repo coverage | Significant security/compliance and support complexity early | Ship public-repo-first; add private auth as a later milestone |
| Real-time live analysis streaming for every internal step | Looks interactive and “advanced” | Adds infra/latency complexity with limited decision value | Use staged progress milestones and completion notifications |
| Exhaustive snippet capture for every file | Feels comprehensive | Report bloat, token/cost explosion, reduced signal quality | Extract snippets only for key claims and critical flows |

## Feature Dependencies

```
[Direct GitHub repo URL input]
    └──requires──> [Repository metadata fetch + validation]
                       └──requires──> [Robust network retry handling]

[Architecture + workflow mapping]
    └──requires──> [Repository indexing and module graph extraction]
                       └──requires──> [Language-aware parsing heuristics]

[Source-linked evidence with line anchors]
    └──requires──> [Stable file path + line range resolution]

[Structured Markdown output report]
    └──requires──> [Report schema/template engine]

[Conclusion-first narrative] ──enhances──> [Structured Markdown output report]
[Dual reference style] ──enhances──> [Source-linked evidence with line anchors]
[Automatic code patch generation] ──conflicts──> [Research-only v1 scope]
[Private-repo auth in v1] ──conflicts──> [Public-repo-first delivery speed]
```

### Dependency Notes

- **Direct GitHub repo URL input requires repository metadata fetch + validation:** URL parsing alone is insufficient; repo existence/access checks are needed before pipeline start.
- **Repository metadata fetch + validation requires robust network retry handling:** GitHub API/network failures must not abort unattended runs.
- **Architecture + workflow mapping requires repository indexing and module graph extraction:** Cross-module understanding depends on an intermediate structural model.
- **Repository indexing and module graph extraction requires language-aware parsing heuristics:** Generic text scan misses call boundaries and flow intent.
- **Source-linked evidence with line anchors requires stable file path + line range resolution:** Evidence is only auditable if links land at the intended code.
- **Structured Markdown output report requires report schema/template engine:** Consistent format is needed for comparability across runs.
- **Conclusion-first narrative enhances structured report output:** Improves actionability without changing core extraction pipeline.
- **Dual reference style enhances source-linked evidence:** Users can choose reproducible (SHA) or current (branch) views.
- **Automatic code patch generation conflicts with research-only v1 scope:** It introduces execution risk and dilutes core research value.
- **Private-repo auth in v1 conflicts with public-repo-first delivery speed:** Security and support overhead delay validating the primary value proposition.

## MVP Definition

### Launch With (v1)

Minimum viable product — what's needed to validate the concept.

- [ ] Direct GitHub repo URL input and validation — enables immediate, explicit target selection
- [ ] Core-first repository analysis (modules + workflows) — proves analytical usefulness quickly
- [ ] Evidence-backed findings with GitHub file/line links — establishes trust and traceability
- [ ] Standardized conclusion-first Markdown report — makes output decision-ready and reusable
- [ ] Unattended execution with progress logs and retry — satisfies long-run reliability requirement

### Add After Validation (v1.x)

Features to add once core is working.

- [ ] Dual reference links (commit SHA + latest branch) — add when teams request reproducibility plus freshness
- [ ] Phased large-repo scan with merged synthesis — add when repo-size limits appear in real usage
- [ ] Additional input modes (search-based repo discovery, local repo input) — add after URL-first flow is stable

### Future Consideration (v2+)

Features to defer until product-market fit is established.

- [ ] Private repository authentication and enterprise connectors — defer pending security model and demand validation
- [ ] Optional issue/PR drafting from findings — defer until research quality is consistently high
- [ ] Interactive exploration UI over report artifacts — defer until workflow bottlenecks justify UI complexity

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| Direct GitHub repo URL input + validation | HIGH | LOW | P1 |
| Core module/workflow mapping | HIGH | HIGH | P1 |
| Source-linked evidence anchors | HIGH | MEDIUM | P1 |
| Standardized conclusion-first report | HIGH | MEDIUM | P1 |
| Unattended run + retry + progress logs | HIGH | HIGH | P1 |
| Dual reference links (SHA + branch) | MEDIUM | MEDIUM | P2 |
| Large-repo phased scan + synthesis | HIGH | HIGH | P2 |
| Search-based/local input modes | MEDIUM | MEDIUM | P2 |
| Private repo auth/connectors | HIGH | HIGH | P3 |
| Issue/PR drafting from findings | MEDIUM | HIGH | P3 |

**Priority key:**
- P1: Must have for launch
- P2: Should have, add when possible
- P3: Nice to have, future consideration

## Competitor Feature Analysis

| Feature | Competitor A | Competitor B | Our Approach |
|---------|--------------|--------------|--------------|
| Repo understanding depth | Broad summaries, limited deep traceability in many tools | Often optimized for Q&A over complete research reports | Depth-first architecture/workflow analysis with explicit synthesis |
| Evidence traceability | Mixed; links may be coarse or absent | Often cites files without method-level anchors | Require line-anchored evidence for key findings |
| Long unattended execution reliability | Some tools target interactive sessions | Some pipelines fail hard on transient errors | Completion-focused retries, staged logging, resumable behavior |
| Report structure/actionability | Variable formatting and narrative order | Can be verbose without decision framing | Conclusion-first standardized Markdown with clear evidence sections |

## Sources

- `.planning/PROJECT.md` (project requirements, constraints, scope)
- `/Users/eddy/.codex/get-shit-done/templates/research-project/FEATURES.md` (required template structure and guidance)
- Domain inference from common GitHub code research tooling patterns

---
*Feature research for: GitHub repository research automation*
*Researched: 2026-03-04*
