# Akomapa Academy v1 implementation order

The GitHub `Blocked by` links are the authoritative dependency graph. The waves below are the recommended delivery order. Work inside a wave may run in parallel when its direct blockers are closed.

Tests are not a final phase. Each feature or fix must add its own unit, integration, authorization, accessibility, or browser coverage as appropriate. Issues #106–#109 establish and enforce the shared quality infrastructure; they do not replace feature-level tests.

## Continuous quality lane

Start the test and CI foundations during Wave 1 and expand them with every later slice:

- #106: unit-test runner, fixtures, and core domain coverage.
- #107: isolated PostgreSQL, migration, RLS, route, transaction, and webhook integration harness.
- #108: authenticated Playwright identities, seeded journeys, and failure artifacts.
- #109: accessibility, responsive visual, performance, and changed-code coverage gates.

These issues may remain open while coverage accumulates, but their harnesses should land early enough that product work uses them rather than creating temporary test approaches.

## Wave 0 — human decisions and release definition

- #36 product, design, domain, and ADR sources of truth.
- #37 Phase 1–5 implementation matrix and executable v1 checklist.
- #38 privacy, educational safety, support, retention, and incident policies.
- #70 AI architecture, threat model, safety rubric, and evaluation dataset.

Do not block unrelated P0 remediation while these decisions are in progress. Only dependent design, policy, retention, and AI choices must wait.

## Wave 1 — stop integrity and security failures

- #39 cross-course Topic access.
- #40 progress, completion, and certificate spoofing.
- #41 Quiz submission binding.
- #42 centralized RBAC and ownership.
- #43 versioned RLS and transaction-scoped principals.
- #44 runtime validation and bounded payloads.
- #45 Origin and CSRF protection.
- #46 rate limits and abuse controls.
- #47 dependency vulnerability remediation.

Exit condition: negative authorization tests pass at the route and database layers, sensitive mutations have validation and abuse defenses, and critical dependency findings are blocked in CI.

## Wave 2 — canonical domain and reliability primitives

- #48 Enrollment-based Course entitlement.
- #49 transactional learning completion and derived events.
- #50 typed domain states.
- #51 constraints, indexes, cascades, retention, and concurrency.
- #52 Chapter-to-Topic migration.
- #69 transactional outbox and idempotent processor.
- #102 structured logging, correlation, traces, and alerts.
- #103 health, readiness, and startup validation.

Exit condition: later features consume one entitlement API, one completion transaction, typed states, idempotent event delivery, and observable failure paths.

## Wave 3 — commerce and core learning journey

- #53–#57 Course discovery, exact pricing, payment reconciliation, content access, and billing UX.
- #58–#62 navigation, completion rules, time accuracy, prerequisites, and resilient Course player states.

Prioritize #54–#56 and #58–#59 before visual enhancements because they protect money, access, and completion integrity.

## Wave 4 — assessments

- #63 atomic Quiz Attempt state machine.
- #64 attempt limits, retries, autosave, reconnection, and abandonment.
- #65 publication invariants.
- #66 deterministic randomization.
- #67 grade and analytics correctness.
- #68 accessible Quiz interaction.

Exit condition: start-to-results is an authenticated, idempotent, keyboard-operable journey with deterministic grading and negative mismatch tests.

## Wave 5 — engagement, authoring, and administration

- #80–#85 Community safety, rich-text safety, Journals, Badges, Certificates, and Case Studies.
- #86–#90 ADMIN/FACULTY separation, authoring, learner administration, moderation, and analytics.

Complete #81 and #86 before enabling broader authoring or moderation because they define content and ownership boundaries.

## Wave 6 — AI Pro v1

- #71 provider seam.
- #72 subscription reconciliation.
- #73 usage, quota, cost, and concurrency accounting.
- #74 authorized Course ingestion and retrieval.
- #75 grounded Q&A.
- #76 streaming conversations.
- #77 faculty-controlled adaptive Quiz variants.
- #78 AI abuse and data-exfiltration defenses.
- #79 evaluations, quality operations, cost alerts, and kill switch.

AI learner access must remain disabled until #70, #72–#75, #78, and the relevant evaluation gates in #79 are complete. Purchased Course access must remain independent from AI subscription state.

## Wave 7 — responsive and accessible product finish

- #94 design-system inventory.
- #95 responsive route audit.
- #96 WCAG semantics and interaction.
- #97 visual preferences and chart alternatives.
- #98 mobile interaction fixes.
- #99 shared asynchronous states.
- #100 form and destructive-action UX.
- #101 human visual sign-off.

Shared primitives should land before page-by-page fixes. Run accessibility and responsive checks continuously; #101 is the final review, not the first design inspection.

## Wave 8 — production proof and release

- #104 backup and restore drill.
- #105 performance and safe-cache budgets.
- #106–#109 final quality-gate completion.
- #110 branch-driven SemVer classification.
- #111 collision-safe release serialization.
- #112 authoritative build version.
- #113 preview, staging, production, migration, supply-chain, and rollback gates.

The `v1.0.0 Production Ready` milestone closes only after all `release-blocker` issues are closed and the evidence required by #104, #107–#109, and #113 is attached.

## Post-v1 AI and growth

- #91 personalized study plans and knowledge-gap coaching.
- #92 opt-in reflection coaching, multilingual summaries, and accessible explanations.
- #93 faculty authoring copilot with mandatory review.

These remain in `Post-v1 AI & Growth` and must not delay v1 unless a maintainer explicitly moves them into the release milestone.
