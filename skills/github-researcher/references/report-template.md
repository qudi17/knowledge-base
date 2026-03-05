# GitHub Idea and Reuse Report Template

Use this template to deliver fast, implementation-focused research.

## 1) Scope

- Feature goal: `<what you want to build>`
- Candidate repositories: `<owner/repo list>`
- Reuse depth target: `<idea-only | partial-code-reuse | drop-in module>`
- Constraints: `<language/runtime/license/dependency limits>`
- Evaluation date: `<YYYY-MM-DD>`

## 2) Recommendation

- Primary approach: `<best repo/pattern>`
- Backup approach: `<second-best option>`
- Confidence: `<high / medium / low>`
- Why this is practical now: `<2-4 bullets>`

## 3) Candidate Snapshot

For each candidate:

- Feature location: `<paths and key symbols>`
- Reuse type: `<copy-adapt / wrap / reimplement>`
- Dependency impact: `<low / medium / high>`
- License note: `<compatible / needs-review / incompatible>`

## 4) Reusable Units

List concrete units with exact paths:

- Unit: `<file or module path>`
- Purpose: `<what behavior it provides>`
- Inputs/Outputs: `<contract summary>`
- Required adaptations: `<what must change locally>`
- Estimated effort: `<S/M/L>`

## 5) Rubric Scoring (1-5)

- Problem Match: `<score>` - `<reason>`
- Reusable Code Granularity: `<score>` - `<reason>`
- Integration Cost: `<score>` - `<reason>`
- Code Clarity and Architecture: `<score>` - `<reason>`
- Reliability Signals: `<score>` - `<reason>`
- License Compatibility: `<score>` - `<reason>`
- Overall: `<weighted conclusion>`

## 6) Integration Plan (Minimal Path)

- Step 1: `<extract or reimplement first unit>`
- Step 2: `<add adapter layer/interfaces>`
- Step 3: `<wire into existing flow>`
- Step 4: `<validate with focused tests>`
- Rollback plan: `<how to safely back out>`

## 7) Risks and Unknowns

- Top risks: `<3-5 items>`
- Unknowns to verify in PoC: `<3 items>`
- Red flags triggered: `<yes/no list>`
