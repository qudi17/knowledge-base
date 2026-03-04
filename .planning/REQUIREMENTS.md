# Requirements: GitHub Project Research Skill

**Defined:** 2026-03-04
**Core Value:** Produce decision-ready, deeply traceable GitHub project research reports with clear conclusions backed by source-linked code evidence.

## v1 Requirements

Requirements for initial release. Each maps to roadmap phases.

### Inputs

- [ ] **INPT-01**: User can start a run by providing a GitHub repository URL.
- [ ] **INPT-02**: User can start a run by selecting a repository from keyword-based GitHub search results.
- [ ] **INPT-03**: User can start a run from a local repository directory path.
- [ ] **INPT-04**: System validates repository target and normalizes canonical owner/repo reference before analysis.

### Analysis

- [ ] **ANLY-01**: System identifies core modules of the target project and explains each module's role.
- [ ] **ANLY-02**: System reconstructs end-to-end core workflows across modules.
- [ ] **ANLY-03**: System applies core-first analysis, then expands to full-repository coverage.
- [ ] **ANLY-04**: System records explicit coverage summary, including scanned scope and known gaps.
- [ ] **ANLY-05**: System supports phased analysis for very large repositories and merges results into one coherent output.

### Evidence

- [ ] **EVID-01**: Each key conclusion includes at least one source-linked code citation.
- [ ] **EVID-02**: Citations include GitHub source links with line anchors.
- [ ] **EVID-03**: Key findings include function/method-level code snippets.
- [ ] **EVID-04**: Report includes both commit-SHA-pinned links and default-branch links when available.

### Reporting

- [ ] **REPT-01**: System outputs a standardized local Markdown report per run.
- [ ] **REPT-02**: Report structure is conclusion-first, with evidence sections following each major conclusion.
- [ ] **REPT-03**: Report includes architecture overview and at least one cross-module workflow diagram.
- [ ] **REPT-04**: Report includes actionable adoption recommendation (adopt / not adopt / conditional) with rationale.

### Execution Reliability

- [ ] **RELY-01**: System runs fully unattended once triggered.
- [ ] **RELY-02**: System logs stage-level progress throughout execution.
- [ ] **RELY-03**: System retries transient failures automatically.
- [ ] **RELY-04**: System supports resume from checkpoint after interruption.
- [ ] **RELY-05**: System continues execution toward completion unless hard-fail criteria are met.

## v2 Requirements

Deferred to future release. Tracked but not in current roadmap.

### Security & Access

- **SECU-01**: User can analyze private GitHub repositories via secure token/auth integration.
- **SECU-02**: System supports enterprise GitHub environments and policy constraints.

### Collaboration & Delivery

- **COLL-01**: System can publish reports to shared channels (e.g., internal docs/wiki).
- **COLL-02**: System supports report diff/comparison across multiple runs.

## Out of Scope

Explicitly excluded. Documented to prevent scope creep.

| Feature | Reason |
|---------|--------|
| Automatic code modification or patch generation in analyzed repositories | v1 scope is strictly research-only to preserve safety and trust |
| Real-time streaming of every internal analysis step | Adds high complexity with limited decision value versus staged logs |
| Private-repo authentication in v1 | Security/compliance overhead deferred until public-repo flow is validated |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| INPT-01 | Phase TBD | Pending |
| INPT-02 | Phase TBD | Pending |
| INPT-03 | Phase TBD | Pending |
| INPT-04 | Phase TBD | Pending |
| ANLY-01 | Phase TBD | Pending |
| ANLY-02 | Phase TBD | Pending |
| ANLY-03 | Phase TBD | Pending |
| ANLY-04 | Phase TBD | Pending |
| ANLY-05 | Phase TBD | Pending |
| EVID-01 | Phase TBD | Pending |
| EVID-02 | Phase TBD | Pending |
| EVID-03 | Phase TBD | Pending |
| EVID-04 | Phase TBD | Pending |
| REPT-01 | Phase TBD | Pending |
| REPT-02 | Phase TBD | Pending |
| REPT-03 | Phase TBD | Pending |
| REPT-04 | Phase TBD | Pending |
| RELY-01 | Phase TBD | Pending |
| RELY-02 | Phase TBD | Pending |
| RELY-03 | Phase TBD | Pending |
| RELY-04 | Phase TBD | Pending |
| RELY-05 | Phase TBD | Pending |

**Coverage:**
- v1 requirements: 22 total
- Mapped to phases: 0
- Unmapped: 22 ⚠️

---
*Requirements defined: 2026-03-04*
*Last updated: 2026-03-04 after initial definition*
