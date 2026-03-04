# Roadmap: GitHub Project Research Skill

## Overview

This roadmap delivers a research-only GitHub analysis skill from validated repo intake through resilient unattended execution, deep architecture/workflow analysis, evidence-backed conclusions, and standardized decision-ready reporting.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [ ] **Phase 1: Repository Intake Foundation** - Start runs from GitHub URLs with normalized canonical repository identity.
- [ ] **Phase 2: Unattended Execution Reliability** - Make runs resilient, resumable, and completion-focused without operator intervention.
- [ ] **Phase 3: Search-Based Repository Selection** - Start runs from GitHub keyword search result selection.
- [ ] **Phase 4: Local Repository Input** - Start runs from local repository directory targets.
- [ ] **Phase 5: Core Architecture and Workflow Analysis** - Produce core module understanding and end-to-end workflow reconstruction.
- [ ] **Phase 6: Coverage Accounting and Large-Repo Phasing** - Expand to full-repo analysis with explicit scope accounting and phased merge support.
- [ ] **Phase 7: Evidence and Citation Guarantees** - Enforce snippet-backed, line-anchored, reproducible citations for key findings.
- [ ] **Phase 8: Decision-Ready Report Synthesis** - Generate standardized conclusion-first reports with diagram and adoption recommendation.

## Phase Details

### Phase 1: Repository Intake Foundation
**Goal**: Users can trigger analysis from a GitHub URL and the system always operates on a validated canonical repository reference.
**Depends on**: Nothing (first phase)
**Requirements**: INPT-01, INPT-04
**Success Criteria** (what must be TRUE):
  1. User can start a run by providing a GitHub repository URL.
  2. Invalid or malformed repository targets are rejected before analysis starts.
  3. Accepted GitHub targets are normalized to a canonical owner/repo reference used by the run.
**Plans**: TBD

### Phase 2: Unattended Execution Reliability
**Goal**: Runs execute to completion-oriented terminal states without manual babysitting, with transparent progress and recovery behavior.
**Depends on**: Phase 1
**Requirements**: RELY-01, RELY-02, RELY-03, RELY-04, RELY-05
**Success Criteria** (what must be TRUE):
  1. User can trigger a run once and let it continue unattended.
  2. User can see stage-level progress updates throughout the run lifecycle.
  3. Transient failures are retried automatically without user intervention.
  4. Interrupted runs can resume from checkpoint instead of restarting from scratch.
  5. Runs continue toward completion unless hard-fail criteria are reached.
**Plans**: TBD

### Phase 3: Search-Based Repository Selection
**Goal**: Users can discover and choose a target repository via keyword search, then launch analysis directly from results.
**Depends on**: Phase 1
**Requirements**: INPT-02
**Success Criteria** (what must be TRUE):
  1. User can search GitHub repositories by keyword from the skill workflow.
  2. User can select one result and immediately start a run from that selection.
**Plans**: TBD

### Phase 4: Local Repository Input
**Goal**: Users can run the same research workflow against a local repository path.
**Depends on**: Phase 2
**Requirements**: INPT-03
**Success Criteria** (what must be TRUE):
  1. User can provide a local repository directory path as the run target.
  2. Run starts and proceeds using the local repository input path.
**Plans**: TBD

### Phase 5: Core Architecture and Workflow Analysis
**Goal**: Users receive deep understanding of core modules and end-to-end workflows before broad-scope expansion.
**Depends on**: Phase 2
**Requirements**: ANLY-01, ANLY-02, ANLY-03
**Success Criteria** (what must be TRUE):
  1. Report identifies the target project's core modules and explains each module's role.
  2. Report reconstructs at least one end-to-end core workflow spanning multiple modules.
  3. Analysis execution prioritizes core understanding first, then proceeds to broader repository scanning.
**Plans**: TBD

### Phase 6: Coverage Accounting and Large-Repo Phasing
**Goal**: Users can trust analysis completeness boundaries through explicit coverage reporting and phased handling of very large repositories.
**Depends on**: Phase 5
**Requirements**: ANLY-04, ANLY-05
**Success Criteria** (what must be TRUE):
  1. Report includes explicit coverage summary of scanned scope and known analysis gaps.
  2. Very large repositories are analyzed in phases and merged into one coherent result.
**Plans**: TBD

### Phase 7: Evidence and Citation Guarantees
**Goal**: Every key conclusion is auditable through function-level snippets and reproducible source links.
**Depends on**: Phase 5
**Requirements**: EVID-01, EVID-02, EVID-03, EVID-04
**Success Criteria** (what must be TRUE):
  1. Each key conclusion in the report includes at least one code citation.
  2. Citations include GitHub links with line anchors to exact source locations.
  3. Key findings include function/method-level snippets, not only file-level references.
  4. Citations include commit-SHA-pinned links and default-branch links when available.
**Plans**: TBD

### Phase 8: Decision-Ready Report Synthesis
**Goal**: Users receive one standardized, conclusion-first Markdown report with architecture/workflow visualization and a clear adoption recommendation.
**Depends on**: Phase 6, Phase 7
**Requirements**: REPT-01, REPT-02, REPT-03, REPT-04
**Success Criteria** (what must be TRUE):
  1. Each run outputs a standardized local Markdown report artifact.
  2. Major conclusions appear first, with supporting evidence sections following each conclusion.
  3. Report includes architecture overview and at least one cross-module workflow diagram.
  4. Report includes explicit adopt/not-adopt/conditional recommendation with rationale.
**Plans**: TBD

## Progress

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Repository Intake Foundation | 0/TBD | Not started | - |
| 2. Unattended Execution Reliability | 0/TBD | Not started | - |
| 3. Search-Based Repository Selection | 0/TBD | Not started | - |
| 4. Local Repository Input | 0/TBD | Not started | - |
| 5. Core Architecture and Workflow Analysis | 0/TBD | Not started | - |
| 6. Coverage Accounting and Large-Repo Phasing | 0/TBD | Not started | - |
| 7. Evidence and Citation Guarantees | 0/TBD | Not started | - |
| 8. Decision-Ready Report Synthesis | 0/TBD | Not started | - |
