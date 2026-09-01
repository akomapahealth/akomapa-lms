# v1.0.0 release checklist

The gates that decide whether Akomapa Academy may ship. Each names what proves
it, who signs it, and the issues that close it.

- **Status:** Approved
- **Approver:** Prince Agyei Tuffour (@nanaagyei), 2026-08-30
- **Milestone:** `v1.0.0 Production Ready`
- **Companion:** [implementation matrix](implementation-matrix.md)

## How this differs from the matrix

The [matrix](implementation-matrix.md) answers "was the phase requirement
built". This answers "may it ship". A feature can be `verified` in the matrix
and still block the release, because the matrix measures against the phase
documents and this measures against the gates below.

**The release closes only when every gate is green.** A gate is green when its
evidence is attached, not when its issues are closed: a closed issue with no
linked CI run, migration record, or human signature does not satisfy a gate.

## Gate 1: Security and authorization

Nothing else matters if this is open.

| Requirement | Evidence | Issues |
| --- | --- | --- |
| Principal and role derived server-side; no client-supplied authority | Negative tests at the route layer proving anonymous, wrong-role, and wrong-owner requests are denied | [#42](https://github.com/akomapahealth/akomapa-lms/issues/42) |
| Cross-Course and cross-learner access impossible | Negative tests at both route and database layers | [#39](https://github.com/akomapahealth/akomapa-lms/issues/39), [#43](https://github.com/akomapahealth/akomapa-lms/issues/43) |
| RLS enabled, forced, and versioned in migrations; runtime role cannot bypass | Integration tests against isolated PostgreSQL proving denial with application checks removed | [#43](https://github.com/akomapahealth/akomapa-lms/issues/43) |
| `TEACHER_ID` retired | Absent from the codebase; a real `ADMIN` row exists in production first | [#42](https://github.com/akomapahealth/akomapa-lms/issues/42), [ADR 0001](../adr/0001-identity-authentication-and-rbac.md) |
| Runtime validation and bounded payloads on every mutation | Schema validation at each boundary, with tests for invalid and oversized input | [#44](https://github.com/akomapahealth/akomapa-lms/issues/44) |
| Origin and CSRF protection | Tests proving cross-origin mutation is rejected | [#45](https://github.com/akomapahealth/akomapa-lms/issues/45) |
| Rate limits and abuse controls | Tests proving limits engage | [#46](https://github.com/akomapahealth/akomapa-lms/issues/46) |
| Rich-text content cannot carry script injection | Sanitisation with a test using a hostile payload | [#81](https://github.com/akomapahealth/akomapa-lms/issues/81) |
| No critical production dependency vulnerabilities | Security Audit, Secret Scan, and CodeQL green | [#47](https://github.com/akomapahealth/akomapa-lms/issues/47) |
| Never-logged list honoured | Code review plus a test asserting sensitive fields are absent from log output | [policy 01](../policies/01-data-protection.md), [#102](https://github.com/akomapahealth/akomapa-lms/issues/102) |

**Signed by:** Prince Agyei Tuffour (@nanaagyei) as security owner.

## Gate 2: Data integrity

| Requirement | Evidence | Issues |
| --- | --- | --- |
| `Enrollment` is the only entitlement; no access path reads `Purchase` | Zero `db.purchase` reads in access paths; one entitlement API used everywhere | [#48](https://github.com/akomapahealth/akomapa-lms/issues/48), [ADR 0002](../adr/0002-enrollment-as-canonical-entitlement.md) |
| Completion, grading, badges, streaks, and certificates commit in one transaction | Integration tests for partial failure and concurrent completion | [#49](https://github.com/akomapahealth/akomapa-lms/issues/49), [ADR 0004](../adr/0004-transactional-completion-and-events.md) |
| Progress and certificates cannot be forged | Regression tests that fail before the fix | [#40](https://github.com/akomapahealth/akomapa-lms/issues/40) |
| Quiz submission bound to the authenticated attempt | Negative tests for mismatched attempt, question, and option | [#41](https://github.com/akomapahealth/akomapa-lms/issues/41) |
| Exact money representation; no float prices | Migration evidence and tests | [#55](https://github.com/akomapahealth/akomapa-lms/issues/55) |
| Payment reconciliation idempotent under retry and replay | Tests delivering the same Stripe event twice | [#54](https://github.com/akomapahealth/akomapa-lms/issues/54), [#69](https://github.com/akomapahealth/akomapa-lms/issues/69) |
| Constraints, indexes, cascades, and concurrency correct | Migration evidence | [#51](https://github.com/akomapahealth/akomapa-lms/issues/51) |
| Chapter to Topic migration complete | Migration evidence, redirects, and updated CONTEXT.md | [#52](https://github.com/akomapahealth/akomapa-lms/issues/52) |

**Signed by:** Prince Agyei Tuffour (@nanaagyei).

## Gate 3: Testing

The matrix shows why this gate exists: no phase requirement currently has a
regression test.

| Requirement | Evidence | Issues |
| --- | --- | --- |
| Unit-test runner, fixtures, and core domain coverage | Stable npm script, green in CI | [#106](https://github.com/akomapahealth/akomapa-lms/issues/106) |
| Isolated PostgreSQL integration harness covering routes, RLS, transactions, migrations, webhooks | Green in CI with useful failure artifacts | [#107](https://github.com/akomapahealth/akomapa-lms/issues/107) |
| Authenticated Playwright journeys with seeded identities | Green in CI, artifacts on failure | [#108](https://github.com/akomapahealth/akomapa-lms/issues/108) |
| Accessibility, responsive, and performance gates on changed code | Green in CI | [#109](https://github.com/akomapahealth/akomapa-lms/issues/109) |
| Every bug and security fix carries a regression that fails before the change | Per-PR review | Epic [#23](https://github.com/akomapahealth/akomapa-lms/issues/23) |
| Documentation consistency checks run in CI | `npm run test:checks` green | This issue |
| AI evaluation dataset structurally valid | `npm run test:evals` green | [#70](https://github.com/akomapahealth/akomapa-lms/issues/70) |

**Signed by:** Prince Agyei Tuffour (@nanaagyei).

## Gate 4: Accessibility

Baseline is WCAG 2.2 AA, binding per [DESIGN.md](../../DESIGN.md).

| Requirement | Evidence | Issues |
| --- | --- | --- |
| Semantics, names, roles, and announcements | Automated checks plus manual keyboard walkthrough | [#96](https://github.com/akomapahealth/akomapa-lms/issues/96) |
| Quiz interface fully keyboard operable | Authenticated E2E covering the quiz by keyboard alone | [#68](https://github.com/akomapahealth/akomapa-lms/issues/68) |
| Responsive from 360px, and usable at 200% zoom | Route-by-route audit | [#95](https://github.com/akomapahealth/akomapa-lms/issues/95), [#98](https://github.com/akomapahealth/akomapa-lms/issues/98) |
| Reduced motion, colour-independent status, chart alternatives | Per-surface verification | [#97](https://github.com/akomapahealth/akomapa-lms/issues/97) |
| Shared async, empty, and error states | The gap the matrix records at 5.15 to 5.17 | [#99](https://github.com/akomapahealth/akomapa-lms/issues/99) |
| Form and destructive-action UX | Per-surface verification | [#100](https://github.com/akomapahealth/akomapa-lms/issues/100) |
| Human visual and consistency sign-off | Recorded approval | [#101](https://github.com/akomapahealth/akomapa-lms/issues/101) |

**Signed by:** Prince Agyei Tuffour (@nanaagyei), with the design exception
process in DESIGN.md for anything intentionally deviating.

## Gate 5: Recovery and operations

| Requirement | Evidence | Issues |
| --- | --- | --- |
| Backups inventoried; RPO and RTO approved | Versioned documentation. **No RPO or RTO may be published before the drill** | [#104](https://github.com/akomapahealth/akomapa-lms/issues/104), [policy 06](../policies/06-incident-response.md) |
| Timed non-production restore drill performed | Timestamps, artifacts, measured recovery, human sign-off | [#104](https://github.com/akomapahealth/akomapa-lms/issues/104) |
| Migration rollback or forward-fix classified per migration | Documented preflight, abort, and verification criteria | [#104](https://github.com/akomapahealth/akomapa-lms/issues/104), [#51](https://github.com/akomapahealth/akomapa-lms/issues/51) |
| Structured logging, correlation, traces, alerts | Dashboards and a triggered test alert | [#102](https://github.com/akomapahealth/akomapa-lms/issues/102) |
| Health, readiness, and startup validation | Endpoints returning correct state under a broken dependency | [#103](https://github.com/akomapahealth/akomapa-lms/issues/103) |
| Performance and safe-cache budgets | Measured against budgets | [#105](https://github.com/akomapahealth/akomapa-lms/issues/105) |
| Incident severity, roles, and notification understood | [policy 06](../policies/06-incident-response.md) approved | [#38](https://github.com/akomapahealth/akomapa-lms/issues/38) |

**Signed by:** Prince Agyei Tuffour (@nanaagyei) as incident lead.

## Gate 6: Deployment and release

| Requirement | Evidence | Issues |
| --- | --- | --- |
| Branch-driven SemVer classification | Correct version produced from commit history | [#110](https://github.com/akomapahealth/akomapa-lms/issues/110), [ADR 0007](../adr/0007-semantic-release-versioning.md) |
| Collision-safe release serialisation | Two concurrent releases cannot race for a tag | [#111](https://github.com/akomapahealth/akomapa-lms/issues/111) |
| One authoritative application version, exposed at runtime | Health endpoint reports the released version and commit | [#112](https://github.com/akomapahealth/akomapa-lms/issues/112) |
| Preview, staging, production, migration, supply-chain, and rollback gates | Documented and exercised | [#113](https://github.com/akomapahealth/akomapa-lms/issues/113) |
| Environment examples and runbooks current | `.env.example` matches deployed configuration | Per-PR review |

**Signed by:** Prince Agyei Tuffour (@nanaagyei).

## Gate 7: Policy, product, and human decisions

Every gate below is a decision, not code. None may be resolved by inference.

| Decision | Owner issue | Status |
| --- | --- | --- |
| Product, design, domain, and architecture sources of truth | [#36](https://github.com/akomapahealth/akomapa-lms/issues/36) | Delivered |
| Privacy, safety, support, retention, incident policies | [#38](https://github.com/akomapahealth/akomapa-lms/issues/38) | Delivered, with six clauses pending legal review |
| AI architecture, threat model, safety rubric, evaluation dataset | [#70](https://github.com/akomapahealth/akomapa-lms/issues/70) | Delivered |
| Course pricing, currency, scholarship, refunds | [#114](https://github.com/akomapahealth/akomapa-lms/issues/114) | Open |
| Numeric launch success thresholds | [#115](https://github.com/akomapahealth/akomapa-lms/issues/115) | Open |
| Self-service deletion and export | [#117](https://github.com/akomapahealth/akomapa-lms/issues/117) | Open |
| Automated retention enforcement | [#118](https://github.com/akomapahealth/akomapa-lms/issues/118) | Open |
| Published privacy and terms updated to match approved policy | [#119](https://github.com/akomapahealth/akomapa-lms/issues/119) | Open |
| Certificate revocation | [#120](https://github.com/akomapahealth/akomapa-lms/issues/120) | Open |
| Email notification capability gap | [#121](https://github.com/akomapahealth/akomapa-lms/issues/121) | Open |
| Legal review of the six marked clauses | [#38](https://github.com/akomapahealth/akomapa-lms/issues/38) | Open |

**Not required for v1:** AI provider selection
([#123](https://github.com/akomapahealth/akomapa-lms/issues/123)) and the AI
educational and cost owners
([#124](https://github.com/akomapahealth/akomapa-lms/issues/124)). AI Pro is out
of v1 scope, so these gate the AI feature, not this release.

## Wave order

The dependency graph is the `Blocked by` links on the issues themselves. The
recommended order is in
[docs/agents/implementation-order.md](../agents/implementation-order.md).

**Safe to run in parallel** once Wave 1 lands, because they touch different
boundaries:

- The testing foundations ([#106](https://github.com/akomapahealth/akomapa-lms/issues/106) to [#109](https://github.com/akomapahealth/akomapa-lms/issues/109)) alongside any feature wave. They should land early so product work uses them instead of inventing temporary approaches.
- Accessibility and responsive work (Wave 7) alongside Waves 3 to 5, provided the shared primitives in [#99](https://github.com/akomapahealth/akomapa-lms/issues/99) land first.
- Observability ([#102](https://github.com/akomapahealth/akomapa-lms/issues/102)) and health checks ([#103](https://github.com/akomapahealth/akomapa-lms/issues/103)) alongside anything.
- Release plumbing ([#110](https://github.com/akomapahealth/akomapa-lms/issues/110) to [#112](https://github.com/akomapahealth/akomapa-lms/issues/112)) alongside anything.

**Must be serial:**

- [#42](https://github.com/akomapahealth/akomapa-lms/issues/42) before [#43](https://github.com/akomapahealth/akomapa-lms/issues/43): RLS needs the principal the RBAC module derives.
- [#48](https://github.com/akomapahealth/akomapa-lms/issues/48) before the commerce and player waves, so they consume one entitlement API.
- [#49](https://github.com/akomapahealth/akomapa-lms/issues/49) and [#69](https://github.com/akomapahealth/akomapa-lms/issues/69) before badges, streaks, and certificates.
- [#51](https://github.com/akomapahealth/akomapa-lms/issues/51) before [#104](https://github.com/akomapahealth/akomapa-lms/issues/104): a restore drill needs the final schema.
- [#101](https://github.com/akomapahealth/akomapa-lms/issues/101) last.

## Closing the milestone

`v1.0.0 Production Ready` closes when all seven gates are green, every
`release-blocker` issue is closed, and the evidence required by
[#104](https://github.com/akomapahealth/akomapa-lms/issues/104),
[#107](https://github.com/akomapahealth/akomapa-lms/issues/107) to
[#109](https://github.com/akomapahealth/akomapa-lms/issues/109), and
[#113](https://github.com/akomapahealth/akomapa-lms/issues/113) is attached to
those issues.
