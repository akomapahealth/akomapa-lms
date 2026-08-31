# Claude repository guidance

This is the secondary agent entry point for Akomapa Academy. `AGENTS.md` remains the canonical root guidance; read it before changing the repository. The files under `docs/agents/` define the shared workflow for every coding agent.

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

### Delivery order

Implement release work in dependency waves and keep tests inside each vertical slice. See `docs/agents/implementation-order.md`.

## Working agreement

- Read the full GitHub issue, its parent epic, blockers, and linked decisions before implementation.
- Treat the issue's acceptance criteria, required test coverage, CI checks, and completion evidence as one deliverable.
- Do not defer tests, authorization checks, observability, accessibility, migrations, or rollback notes to an unspecified later task.
- Preserve the Course → Module → Topic vocabulary; `Chapter` is a legacy route and storage term only. `CONTEXT.md` is the authority on every domain term.
- Stop for a `ready-for-human` decision instead of silently choosing pricing, policy, destructive migration, AI safety, or final visual direction.
