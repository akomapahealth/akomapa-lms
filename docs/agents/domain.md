# Domain documentation

This repository uses a single-context domain documentation layout.

## Sources of truth

These exist and are binding. Before changing a domain area, read:

- [`CONTEXT.md`](../../CONTEXT.md) for canonical domain terms, legacy terminology, naming rules, and system invariants.
- [`PRODUCT.md`](../../PRODUCT.md) for audiences, purpose, the paid/free boundary, anti-references, and open product decisions.
- [`DESIGN.md`](../../DESIGN.md) for approved tokens, the navigation model, responsive floors, the accessible state vocabulary, and the exception process.
- The relevant records under [`docs/adr/`](../adr/README.md) for the architectural seam you are about to cross.
- The relevant policy under [`docs/policies/`](../policies/README.md) when the change touches personal data, retention, AI, moderation, support, or incident behavior.
- The phase specifications under `docs/phase-*.md` for implementation history.

Where a document and the code disagree, the document is the decision and the code is the defect, unless an ADR says otherwise. Create or update domain terminology and ADRs only when a decision has been approved, and record the approver by name.

## Vocabulary

Use the domain terms Course, Module, Topic, Enrollment, Quiz, Quiz Attempt, Community, Journal Entry, Learning Streak, Badge, Case Study, Certificate, Faculty, Administrator, Learner, and AI Pro consistently in issues and implementation work.

Treat `Chapter` as a legacy storage and route term during the Topic migration; do not introduce new learner-facing uses of it.
