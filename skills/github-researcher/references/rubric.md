# Reuse-Oriented Rubric

Use this rubric to select repositories for idea mining and partial code reuse.
Score each dimension from 1 to 5.

## 1. Problem Match (Weight: High)

- 1: Only loosely related to target feature
- 3: Covers part of the target flow
- 5: Directly solves the same feature with similar constraints

## 2. Reusable Code Granularity (Weight: High)

- 1: Logic too entangled for extraction
- 3: Some reusable modules with moderate decoupling effort
- 5: Clear boundaries and self-contained units ready for `copy-adapt` or `wrap`

## 3. Integration Cost (Weight: High)

- 1: Heavy framework/runtime lock-in, high dependency drag
- 3: Moderate adaptation and dependency trimming required
- 5: Minimal dependencies, easy adapter-layer integration

## 4. Code Clarity and Architecture

- 1: Opaque flow, inconsistent patterns
- 3: Understandable with some weak areas
- 5: Clear control flow, readable abstractions, explicit interfaces

## 5. Reliability Signals

- 1: No tests and weak validation signals
- 3: Partial tests or basic CI checks
- 5: Strong tests, healthy CI, practical examples matching real use

## 6. License Compatibility

- 1: Missing/unclear/incompatible license for intended reuse
- 3: License clear but with constraints that need review
- 5: Clear license aligned with intended usage model

## Red-Flag Checklist

Mark each as `yes` or `no`:

- License incompatible with intended reuse
- Feature spread across many tightly coupled files
- Core logic hidden behind heavy platform assumptions
- No clear extension points or interfaces
- Example code diverges from production code path
- Dependency footprint too large for target project
