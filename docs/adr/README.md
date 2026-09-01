# Architecture decision records

Each record fixes one architectural seam: the boundary that later work must
build against. A record states the decision and its consequences, not the
implementation. The issue that implements it is named in **Implemented by**.

Read the relevant records before changing a domain area, alongside
[CONTEXT.md](../../CONTEXT.md), [PRODUCT.md](../../PRODUCT.md), and
[DESIGN.md](../../DESIGN.md).

## Index

| ADR | Decision | Status | Implemented by |
| --- | --- | --- | --- |
| [0001](0001-identity-authentication-and-rbac.md) | Clerk is the only identity source; the principal and role are derived on the server | Accepted | [#42](https://github.com/akomapahealth/akomapa-lms/issues/42) |
| [0002](0002-enrollment-as-canonical-entitlement.md) | Enrollment is the only Course entitlement; Purchase is payment evidence | Accepted | [#48](https://github.com/akomapahealth/akomapa-lms/issues/48) |
| [0003](0003-rls-and-transaction-scoped-principal.md) | Row-level security with a transaction-scoped principal | Accepted | [#43](https://github.com/akomapahealth/akomapa-lms/issues/43) |
| [0004](0004-transactional-completion-and-events.md) | Completion, grading, and recognition happen in one transaction that also records events | Accepted | [#49](https://github.com/akomapahealth/akomapa-lms/issues/49) |
| [0005](0005-transactional-outbox-processing.md) | A transactional outbox with an idempotent processor carries all asynchronous work | Accepted | [#69](https://github.com/akomapahealth/akomapa-lms/issues/69) |
| [0006](0006-ai-provider-abstraction.md) | AI access sits behind a provider-neutral seam with a kill switch, disabled in v1 | Accepted | [#71](https://github.com/akomapahealth/akomapa-lms/issues/71) |
| [0007](0007-semantic-release-versioning.md) | Conventional Commits drive semantic-release from `main` | Accepted | [#110](https://github.com/akomapahealth/akomapa-lms/issues/110) |

## Statuses

- **Proposed:** written, not yet approved. Do not build against it.
- **Accepted:** approved and binding. New work conforms or supersedes it.
- **Superseded by NNNN:** replaced. Kept for history; never edited into agreement with its replacement.

## When to write one

Write a record when a decision constrains work beyond the pull request that
makes it: a boundary more than one feature crosses, an invariant that must hold
system wide, a technology commitment that is expensive to reverse, or an
explicit choice not to do something.

Do not write one for a change contained in a single feature, a library upgrade
with no behavioural consequence, or a decision already fixed by an existing
record.

## Process

1. Copy [template.md](template.md) to `NNNN-kebab-case-title.md`, taking the
   next free number.
2. Open it as `Proposed` in the pull request that proposes it.
3. Get a named approver. Pricing, policy, destructive migration, AI safety, and
   final visual direction stop for a `ready-for-human` decision; see
   [CLAUDE.md](../../CLAUDE.md).
4. Set the status to `Accepted` with the approver and date, and add the row to
   the index above, in the same pull request.
5. To reverse a decision, write a new record that supersedes the old one. Never
   rewrite an accepted record's decision in place.
