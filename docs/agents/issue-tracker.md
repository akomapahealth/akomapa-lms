# Issue tracker: GitHub

Issues, epics, and PRDs for this repository live in GitHub Issues at `akomapahealth/akomapa-lms`. Use the `gh` CLI for issue operations from inside this clone so the repository is inferred from the `origin` remote.

## Conventions

- Create issues with `gh issue create`.
- Read the full issue body, comments, labels, milestone, and relationships before modifying an existing issue.
- Search open and closed issues before publishing to avoid duplicates.
- Publish blocker issues before dependent issues so `Blocked by` references use real issue numbers.
- Never close or modify a parent epic while publishing its child issues.
- Treat each child issue as an implementation brief. Preserve the sections `Parent`, `What to build`, `Why this matters`, `Repository context`, `Required implementation coverage`, `Security and data invariants`, `Required test coverage`, `CI and verification`, `Observability, migration, and rollout`, `Acceptance criteria`, `Definition of done and evidence`, `Delivery guidance`, `Out of scope`, and `Blocked by`.
- Tests belong to the implementing issue. The testing epic establishes shared harnesses and gates; it is not permission to defer feature-level unit, integration, authenticated E2E, accessibility, security, or failure-path coverage.
- Follow the dependency waves in `docs/agents/implementation-order.md`. Direct `Blocked by` links take precedence when they are more restrictive.
- When implementation discovery makes an issue too large, split it into thinner end-to-end child issues and update the parent/checklist before coding. Do not replace one vertical slice with separate unshippable database/API/UI/testing tickets.

## Milestones

- `v1.0.0 Production Ready` contains work required for the first complete production release.
- `Post-v1 AI & Growth` contains explicitly deferred AI and growth capabilities.
