# Domain documentation

This repository uses a single-context domain documentation layout.

## Sources of truth

Before changing a domain area, read:

- `CONTEXT.md` at the repository root when it exists.
- Relevant records under `docs/adr/` when they exist.
- The phase specifications under `docs/phase-*.md`.
- `PRODUCT.md` and `DESIGN.md` for product and interface decisions when they exist.

If a source does not exist yet, continue using the implemented behavior and phase documents as evidence. Create or update domain terminology and ADRs only when a decision has been approved.

## Vocabulary

Use the domain terms Course, Module, Topic, Enrollment, Quiz, Quiz Attempt, Community, Journal Entry, Learning Streak, Badge, Case Study, Certificate, Faculty, Administrator, Learner, and AI Pro consistently in issues and implementation work.

Treat `Chapter` as a legacy storage and route term during the Topic migration; do not introduce new learner-facing uses of it.
