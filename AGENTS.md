# Repository guidance

## Agent skills

### Issue tracker

Issues and PRDs are tracked in GitHub for `akomapahealth/akomapa-lms`. See `docs/agents/issue-tracker.md`.

### Triage labels

Use the standard five-role triage vocabulary. See `docs/agents/triage-labels.md`.

### Domain docs

This repository uses a single-context domain documentation layout. See `docs/agents/domain.md`.

### Source-of-truth documents

- `PRODUCT.md`: audiences, purpose, paid/free boundary, anti-references, open decisions.
- `DESIGN.md`: approved tokens, navigation, responsive floors, accessibility baseline, exception process.
- `CONTEXT.md`: canonical domain terms, legacy terminology, invariants.
- `docs/adr/`: approved architectural seams. Start at `docs/adr/README.md`.
- `docs/policies/`: data protection, retention, AI safety, educational scope, support, incident response, moderation, and the obligation-to-control map. Start at `docs/policies/README.md`.
- `docs/release/`: the Phase 1 to 5 implementation matrix and the v1 release checklist. Start at `docs/release/implementation-matrix.md`.

### Delivery order

Implement release work in dependency waves and keep tests inside each vertical slice. See `docs/agents/implementation-order.md`.

### Testing

Four suites with distinct jobs, and the rules the unit harness enforces. See `docs/agents/testing.md`. Run `npm run validate` before opening a pull request.
