# Phase 1 to 5 implementation matrix

Every verification item in `docs/phase-1.md` through `docs/phase-5.md`, mapped
to observable evidence in the repository and given one status.

- **Status:** Approved
- **Approver:** Prince Agyei Tuffour (@nanaagyei), 2026-08-30
- **Audited against:** `dev` at the commit this document was merged in
- **Companion:** [v1 release checklist](v1-release-checklist.md)

## Method

Status was determined by reading the implementation, not by observing that a
file exists. Where a claim is behavioural ("answers validated server-side"),
the route or component was read and the behaviour confirmed or refuted. Where a
claim is structural ("sidebar shows correct routes"), the component and its
data source were read.

Reproduce the evidence gathering with:

```bash
ls prisma/migrations/                          # migration history
find app -name "loading.tsx" -o -name "error.tsx"   # skeletons and boundaries
grep -rln "db\.purchase" app actions lib       # entitlement reads
grep -rln "db\.enrollment" app actions lib
find app/api -path "*quiz*" -name "route.ts"   # quiz boundary
npm run test:checks                            # validates this document
```

`npm run test:checks` validates this file structurally: every status is from
the vocabulary below, every `partial` or `missing` row carries an issue link,
every `superseded` row carries an ADR or policy link, and every repository path
cited in an evidence cell exists. A row cannot silently rot into a false claim.

## Status vocabulary

| Status | Meaning |
| --- | --- |
| `verified` | Implemented, and the behaviour was confirmed by reading the code |
| `partial` | Present but incomplete or not meeting the stated requirement. Carries an issue |
| `missing` | Not implemented. Carries an issue |
| `superseded` | Implemented, but a later approved decision changes what correct means. Carries an ADR or policy |
| `deferred` | Intentionally not done for v1, with a recorded reason |

A `verified` row means the phase requirement is met. It does **not** mean the
behaviour is secure, tested, or accessible: those are separate gates in the
[release checklist](v1-release-checklist.md). Several rows below are `verified`
against the phase document and simultaneously blocked by a Wave 1 security
issue, which is exactly why both documents exist.

## Phase 1: Foundation

| # | Requirement | Status | Evidence | Issue or decision |
| --- | --- | --- | --- | --- |
| 1.1 | `prisma migrate dev` runs successfully | `verified` | Six migrations in `prisma/migrations/`, including `20260609000000_phase1_modules_quizzes_roles` | |
| 1.2 | Data migration script runs without errors | `partial` | Migrations exist; no committed backfill script and no migration evidence retained | [#104](https://github.com/akomapahealth/akomapa-lms/issues/104) |
| 1.3 | Existing chapters appear as topics under default modules | `superseded` | `Topic` is `@@map("Chapter")` in `prisma/schema.prisma`; the rename is storage-level only | [#52](https://github.com/akomapahealth/akomapa-lms/issues/52), [CONTEXT.md](../../CONTEXT.md) |
| 1.4 | Existing purchases have corresponding enrollments | `superseded` | Both models exist, but access still reads `Purchase` in 12 files. ADR 0002 makes `Enrollment` canonical | [ADR 0002](../adr/0002-enrollment-as-canonical-entitlement.md), [#48](https://github.com/akomapahealth/akomapa-lms/issues/48) |
| 1.5 | Sidebar shows correct routes for students | `verified` | `app/(dashboard)/_components/sidebar-routes.tsx` with `app/(dashboard)/_components/sidebar.tsx` | |
| 1.6 | Sidebar shows correct routes for admin users | `verified` | `app/(dashboard)/_components/sidebar-routes.tsx` filters each destination by a capability derived on the server in `app/(dashboard)/layout.tsx`. Previously evidenced by a client-side helper reading Clerk publicMetadata.role, which nothing in the application ever wrote, so every staff route was shown to every faculty member and the navbar link rendered for nobody | [#42](https://github.com/akomapahealth/akomapa-lms/issues/42) |
| 1.7 | Admin layout protects routes | `verified` | `TEACHER_ID` is retired and every page under `app/(dashboard)/(routes)/admin/` declares its own capability through `lib/auth/page.ts`; the layout no longer decides on their behalf. Every route handler calls the same module through `lib/auth/guards.ts`, with ownership asserted in the query | [ADR 0001](../adr/0001-identity-authentication-and-rbac.md), [docs/permission-matrix.md](../permission-matrix.md), [#42](https://github.com/akomapahealth/akomapa-lms/issues/42) |
| 1.8 | Legacy `/teacher` URLs redirect to `/admin` | `partial` | `app/(dashboard)/(routes)/teacher/layout.tsx` redirects unauthorised users, but `/teacher` remains a live route group rather than redirecting to `/admin` | [#86](https://github.com/akomapahealth/akomapa-lms/issues/86) |
| 1.9 | Admin button in navbar appears for admin users | `verified` | `components/navbar-routes.tsx` renders the link from a capability derived on the server. It previously branched on Clerk publicMetadata.role, which nothing ever wrote, so the button rendered for nobody and staff reached /admin only by typing the URL | [#42](https://github.com/akomapahealth/akomapa-lms/issues/42) |
| 1.10 | User info displays at bottom of sidebar | `verified` | `app/(dashboard)/_components/sidebar-user-info.tsx` | |
| 1.11 | Logout button works | `verified` | Clerk `UserButton` in the shell header | |
| 1.12 | `npm run build` succeeds with no type errors | `verified` | Build and Type Check jobs green in `.github/workflows/ci.yml` | |
| 1.13 | Existing course player works with the new schema | `verified` | `app/(course)/courses/[courseId]/chapters/[chapterId]/page.tsx` reads through `Module` to `Topic` | |
| 1.14 | Seed script creates GHELP categories | `verified` | `scripts/seed.ts` seeds course categories, forum categories, and badges | |

## Phase 2: Dashboard and course structure

| # | Requirement | Status | Evidence | Issue or decision |
| --- | --- | --- | --- | --- |
| 2.1 | Welcome banner with user name | `verified` | `app/(dashboard)/(routes)/dashboard/_components/welcome-banner.tsx` | |
| 2.2 | Course selector lists enrolled courses | `partial` | `app/(dashboard)/(routes)/dashboard/_components/course-selector.tsx` exists; its data comes from `actions/get-enrolled-courses.ts`, which reads `Purchase` | [#48](https://github.com/akomapahealth/akomapa-lms/issues/48) |
| 2.3 | Selecting a course updates all widgets | `verified` | Selection is held in URL search params and consumed by the dashboard widgets | |
| 2.4 | Progress donut renders accurate data | `verified` | `app/(dashboard)/(routes)/dashboard/_components/progress-donut-chart.tsx` with `actions/get-course-progress-breakdown.ts` | |
| 2.5 | Topic progress shows per-module bars | `verified` | `app/(dashboard)/(routes)/dashboard/_components/topic-progress-section.tsx` | |
| 2.6 | Quiz progress shows pre/post status | `verified` | `app/(dashboard)/(routes)/dashboard/_components/quiz-progress-section.tsx` with `actions/get-quiz-progress.ts` | |
| 2.7 | Completion timeline with weekly/monthly toggle | `verified` | `app/(dashboard)/(routes)/dashboard/_components/time-progress-chart.tsx` with `actions/get-completion-timeline.ts` | |
| 2.8 | `/courses` shows enrolled courses with status badges | `verified` | `app/(dashboard)/(routes)/courses/page.tsx` with `components/status-badge.tsx` | |
| 2.9 | `/courses/[courseId]` shows expandable modules | `verified` | `app/(dashboard)/(routes)/courses/[courseId]/page.tsx` with `actions/get-course-detail.ts` | |
| 2.10 | Course player sidebar shows nested modules to topics | `verified` | `app/(course)/courses/[courseId]/_components/course-sidebar-module.tsx` and `app/(course)/courses/[courseId]/_components/course-sidebar-item.tsx` | |
| 2.11 | Breadcrumbs work throughout course navigation | `verified` | `components/breadcrumb.tsx`, used in the course player layout | |
| 2.12 | Previous/Next topic navigation, including cross-module | `verified` | Navigation computed across modules in `actions/get-topic.ts`, derived from a Topic bound to the Course through its Module by `lib/courses/topic-access.ts` | [#39](https://github.com/akomapahealth/akomapa-lms/issues/39) |
| 2.13 | Module completion triggers celebration | `partial` | `components/providers/confetti-provider.tsx` fires from `app/(course)/courses/[courseId]/chapters/[chapterId]/_components/video-player.tsx` on video end, which is topic completion, not module completion | [#59](https://github.com/akomapahealth/akomapa-lms/issues/59) |
| 2.14 | All pages responsive on mobile | `partial` | Responsive classes are used throughout and the shell has a mobile nav, but no route-by-route audit has been performed | [#95](https://github.com/akomapahealth/akomapa-lms/issues/95), [#98](https://github.com/akomapahealth/akomapa-lms/issues/98) |
| 2.15 | `npm run build` succeeds | `verified` | Build job green in CI | |

## Phase 3: Quiz engine and grades

| # | Requirement | Status | Evidence | Issue or decision |
| --- | --- | --- | --- | --- |
| 3.1 | Pre-test available at enrollment | `partial` | `app/(course)/courses/[courseId]/quiz/[quizId]/page.tsx` serves it; availability is gated on `Purchase`, not `Enrollment` | [#48](https://github.com/akomapahealth/akomapa-lms/issues/48) |
| 3.2 | Post-test locked until modules complete | `verified` | `actions/check-post-test-lock.ts`, enforced server-side in the start route | |
| 3.3 | Post-test unlocks when the last module completes | `verified` | Same lock action, recomputed per request | |
| 3.4 | Timer counts down and auto-submits at 0 | `verified` | `app/(course)/courses/[courseId]/quiz/[quizId]/_components/quiz-timer.tsx` | |
| 3.5 | Timer warning at 5 minutes | `verified` | `app/(course)/courses/[courseId]/quiz/[quizId]/_components/quiz-timer.tsx` sets `isWarning` at 300 seconds and applies the warning token | |
| 3.6 | Quiz state persists in localStorage | `verified` | `hooks/use-quiz-store.ts` writes, reads, and clears per-quiz state, with try/catch around unavailable storage | |
| 3.7 | Answers validated server-side, keys never sent to client | `verified` | `app/api/courses/[courseId]/quizzes/[quizId]/start/route.ts` selects option `id`, `text`, `position` only, with an explicit comment excluding `isCorrect`. Scoring happens in the submit route | |
| 3.8 | Results show correct/incorrect with explanations | `verified` | `app/(course)/courses/[courseId]/quiz/[quizId]/results/[attemptId]/page.tsx` | |
| 3.9 | Confetti on passing | `verified` | `app/(course)/courses/[courseId]/quiz/[quizId]/results/[attemptId]/_components/results-confetti.tsx` | |
| 3.10 | Admin can create/edit/delete quizzes | `verified` | `app/api/courses/[courseId]/quizzes/route.ts` and `[quizId]/route.ts`, surfaced at `app/(dashboard)/(routes)/admin/quizzes/page.tsx` | |
| 3.11 | Admin can add/edit/delete/reorder questions | `verified` | `questions/route.ts`, `questions/[questionId]/route.ts`, `questions/reorder/route.ts` | |
| 3.12 | Admin can preview quiz | `missing` | No preview route or component exists under the admin quiz surface | [#87](https://github.com/akomapahealth/akomapa-lms/issues/87) |
| 3.13 | Grades overview shows all enrolled courses | `partial` | `app/(dashboard)/(routes)/grades/page.tsx` with `actions/get-grades-overview.ts`, which reads `Purchase` | [#48](https://github.com/akomapahealth/akomapa-lms/issues/48) |
| 3.14 | Grades detail shows module breakdown and attempts | `verified` | `app/(dashboard)/(routes)/grades/[courseId]/page.tsx` with `actions/get-grades-detail.ts` | |
| 3.15 | Score comparison shows pre vs post growth | `verified` | Rendered in the grades detail page from `actions/get-grades-detail.ts` | |
| 3.16 | `npm run build` succeeds | `verified` | Build job green in CI | |

## Phase 4: Community

| # | Requirement | Status | Evidence | Issue or decision |
| --- | --- | --- | --- | --- |
| 4.1 | Community page loads with category tabs | `verified` | `app/(dashboard)/(routes)/community/_components/category-tabs.tsx` | |
| 4.2 | Posts display with author, excerpt, counts | `verified` | `app/(dashboard)/(routes)/community/_components/post-card.tsx` with `actions/get-forum-posts.ts` | |
| 4.3 | Category filtering works | `verified` | Search-param filtering consumed by `actions/get-forum-posts.ts` | |
| 4.4 | Search works with debounce | `verified` | `app/(dashboard)/(routes)/community/_components/post-search.tsx` with `hooks/use-debounce.ts` | |
| 4.5 | Sorting works | `verified` | Sort parameter handled in `actions/get-forum-posts.ts` | |
| 4.6 | Post detail shows content and comments | `verified` | `app/(dashboard)/(routes)/community/[postId]/page.tsx` | |
| 4.7 | Nested replies render, max 2 levels | `verified` | `app/(dashboard)/(routes)/community/[postId]/_components/comment-thread.tsx` | |
| 4.8 | Like toggle with optimistic UI | `verified` | `app/(dashboard)/(routes)/community/_components/like-button.tsx` with the like routes | |
| 4.9 | Create post form validates and submits | `verified` | `app/(dashboard)/(routes)/community/new/_components/create-post-form.tsx` with Zod schemas in `lib/validations` | |
| 4.10 | Rich text renders correctly | `partial` | `react-quill-new` renders authored HTML; no sanitisation layer is present, so stored markup is trusted | [#81](https://github.com/akomapahealth/akomapa-lms/issues/81) |
| 4.11 | Comment form submits and shows the comment | `verified` | `app/(dashboard)/(routes)/community/[postId]/_components/comment-form.tsx` | |
| 4.12 | Reply to comment works inline | `verified` | Handled within `app/(dashboard)/(routes)/community/[postId]/_components/comment-thread.tsx` | |
| 4.13 | Locked posts prevent new comments | `verified` | `isLocked` enforced in `app/api/community/posts/[postId]/comments/route.ts` | |
| 4.14 | Pinned posts appear at top | `verified` | `isPinned` ordering in `actions/get-forum-posts.ts` | |
| 4.15 | Admin can pin/lock/delete posts | `verified` | `app/api/community/posts/[postId]/pin/route.ts`, `lock/route.ts`, `[postId]/route.ts`, surfaced in `app/(dashboard)/(routes)/admin/community/_components/post-moderation-table.tsx` | |
| 4.16 | Community profile shows posts and activity | `verified` | `app/(dashboard)/(routes)/community/profile/[userId]/page.tsx` | |
| 4.17 | Pagination or load more works | `verified` | `actions/get-forum-posts.ts` takes `page` and `limit`, applies `skip`/`take`, and returns `hasMore`; `app/(dashboard)/(routes)/community/page.tsx` renders a Load More link that advances the page and preserves category, search, and sort | |
| 4.18 | `npm run build` succeeds | `verified` | Build job green in CI | |

## Phase 5: Gamification, journals, certificates, polish

| # | Requirement | Status | Evidence | Issue or decision |
| --- | --- | --- | --- | --- |
| 5.1 | Badges seeded correctly | `verified` | `scripts/seed.ts` seeds badge definitions with machine-readable criteria | |
| 5.2 | Badges awarded automatically on qualifying events | `partial` | `lib/badge-service.ts` evaluates and awards, but outside the completion transaction | [ADR 0004](../adr/0004-transactional-completion-and-events.md), [#49](https://github.com/akomapahealth/akomapa-lms/issues/49) |
| 5.3 | Badge notifications appear as toasts | `partial` | `lib/badge-service.ts` returns newly awarded badges "for toast notifications", but no caller renders one | [#83](https://github.com/akomapahealth/akomapa-lms/issues/83) |
| 5.4 | Badge grid displays on dashboard and profile | `verified` | `components/badge-display.tsx` and `app/(dashboard)/(routes)/dashboard/_components/badge-grid.tsx` | |
| 5.5 | Learning streak tracks correctly | `partial` | `lib/streak-service.ts` with `actions/get-user-streak.ts`; increment and reset are not covered by any test, and run outside the completion transaction | [#49](https://github.com/akomapahealth/akomapa-lms/issues/49), [#106](https://github.com/akomapahealth/akomapa-lms/issues/106) |
| 5.6 | Journal list shows entries with filters | `verified` | `app/(dashboard)/(routes)/journal/_components/journal-list.tsx` and `app/(dashboard)/(routes)/journal/_components/journal-filters.tsx` | |
| 5.7 | Journal editor with rich text and auto-save | `verified` | `app/(dashboard)/(routes)/journal/new/_components/journal-editor.tsx` auto-saves on a 5 second debounce via `hooks/use-debounce.ts` | |
| 5.8 | Guided reflection prompts after module completion | `verified` | `Module.reflectionPrompt` passed through `app/(course)/courses/[courseId]/chapters/[chapterId]/page.tsx` into `app/(course)/courses/[courseId]/chapters/[chapterId]/_components/course-progress-button.tsx` | |
| 5.9 | Case study player renders scenarios and choices | `verified` | `app/(course)/courses/[courseId]/chapters/[chapterId]/_components/case-study-player.tsx`, with rich text sanitized on the server by `lib/case-study-sanitize.ts` before it reaches the client. It previously rendered author HTML raw, which was stored XSS against learners | [#81](https://github.com/akomapahealth/akomapa-lms/issues/81) |
| 5.10 | Case study feedback after each choice | `verified` | Handled in `app/(course)/courses/[courseId]/chapters/[chapterId]/_components/case-study-player.tsx` against the scenario JSON | |
| 5.11 | Admin case study editor | `missing` | Only API routes exist under `app/api/courses/[courseId]/case-studies/`; there is no authoring UI | [#85](https://github.com/akomapahealth/akomapa-lms/issues/85) |
| 5.12 | Certificate generates as PDF on completion | `verified` | `lib/certificate-service.ts` and `lib/certificate-template.tsx` with `app/api/courses/[courseId]/certificate/route.ts` | |
| 5.13 | Certificate downloads correctly | `verified` | `app/(dashboard)/(routes)/grades/[courseId]/_components/certificate-section.tsx` | |
| 5.14 | Certificate verification page works, public | `verified` | `app/verify/page.tsx` and `app/verify/[certificateNumber]/page.tsx`; `/verify` is public in `proxy.ts`, and covered by an E2E smoke case | |
| 5.15 | Loading skeletons on all data pages | `missing` | **No `loading.tsx` exists anywhere in `app/`.** `components/ui/skeleton.tsx` is defined and imported by nothing | [#99](https://github.com/akomapahealth/akomapa-lms/issues/99) |
| 5.16 | Empty states on all empty lists | `partial` | 15 files render an inline empty state, including `app/(dashboard)/(routes)/community/page.tsx` and `app/(dashboard)/(routes)/journal/_components/journal-list.tsx`. There is no shared primitive, coverage is uneven, and none follows the three-part pattern in DESIGN.md | [#99](https://github.com/akomapahealth/akomapa-lms/issues/99) |
| 5.17 | Error boundaries catch and display errors | `partial` | Three boundaries exist: `app/error.tsx`, `app/(dashboard)/error.tsx`, `app/(course)/error.tsx`. The marketing, auth, and verify groups have none | [#99](https://github.com/akomapahealth/akomapa-lms/issues/99) |
| 5.18 | Settings page saves preferences | `partial` | `app/(dashboard)/(routes)/settings/_components/settings-form.tsx` persists `UserSettings`, but the three `emailOn*` toggles have no delivery mechanism | [#121](https://github.com/akomapahealth/akomapa-lms/issues/121), [policy 05](../policies/05-support-and-service-levels.md) |
| 5.19 | Dark mode works when toggled | `verified` | `components/providers/theme-provider.tsx`, `components/theme-toggle.tsx`, and a full dark token set in `app/globals.css` | |
| 5.20 | All pages pass mobile responsiveness check | `partial` | No route-by-route audit has been performed | [#95](https://github.com/akomapahealth/akomapa-lms/issues/95) |
| 5.21 | Keyboard navigation works on the quiz interface | `partial` | Radix primitives provide baseline keyboard support; the requirement has never been verified against the quiz flow | [#68](https://github.com/akomapahealth/akomapa-lms/issues/68) |
| 5.22 | Admin analytics show all new panels | `verified` | Six chart components under `app/(dashboard)/(routes)/admin/analytics/_components/` with `actions/get-admin-analytics.ts` | |
| 5.23 | `npm run build` succeeds | `verified` | Build job green in CI | |
| 5.24 | All existing features still work | `partial` | Five unauthenticated request-level smoke cases in `e2e/smoke.spec.ts`. No authenticated journey coverage exists, so this cannot currently be demonstrated | [#108](https://github.com/akomapahealth/akomapa-lms/issues/108) |

## Summary

| Status | Count |
| --- | --- |
| `verified` | 65 |
| `partial` | 17 |
| `missing` | 3 |
| `superseded` | 2 |
| `deferred` | 0 |
| **Total** | **87** |

These counts are asserted by `npm run test:checks`, which parses the tables
above rather than trusting this summary. An earlier hand-written version of
this table was wrong; the check exists because of that.

## Cross-cutting findings

Findings that recur across phases and are more important than any single row.

1. **Entitlement is read from `Purchase` in twelve files.** `actions/get-analytics.ts`, `actions/get-course-detail.ts`, `actions/get-dashboard-courses.ts`, `actions/get-enrolled-courses.ts`, `actions/get-enrolled-modules.ts`, `actions/get-grades-overview.ts`, `actions/get-topic.ts`, `app/(course)/courses/[courseId]/layout.tsx`, `app/(dashboard)/(routes)/community/new/page.tsx`, and three API routes. Six files read `Enrollment`. The two populations disagree, which is the concrete form of the problem [ADR 0002](../adr/0002-enrollment-as-canonical-entitlement.md) fixes. Owner: [#48](https://github.com/akomapahealth/akomapa-lms/issues/48).
2. **Asynchronous UI states were never built.** No `loading.tsx` exists in the application, one file references a skeleton, and three of six route groups have an error boundary. Phase 5 claimed all three. Owner: [#99](https://github.com/akomapahealth/akomapa-lms/issues/99).
3. **Derived state is written outside a transaction.** Badge awarding, streak tracking, and certificate issuance each run as separate service calls after the progress write. Owner: [#49](https://github.com/akomapahealth/akomapa-lms/issues/49), per [ADR 0004](../adr/0004-transactional-completion-and-events.md).
4. **Nothing is covered by an automated test except the five smoke cases and the AI dataset validator.** No phase requirement above has a regression test. Several rows are `partial` for this reason alone: the behaviour reads correctly but nothing prevents it from regressing. Owner: [#106](https://github.com/akomapahealth/akomapa-lms/issues/106), [#107](https://github.com/akomapahealth/akomapa-lms/issues/107), [#108](https://github.com/akomapahealth/akomapa-lms/issues/108).
5. **Two rows were corrected during the audit, in both directions.** A first pass marked community pagination `missing` on the strength of a grep that searched for the wrong identifiers; reading `actions/get-forum-posts.ts` and the page showed it fully implemented. A first pass also undercounted empty states because a shell flag failed silently. Both are recorded here rather than quietly fixed, because they are the exact failure mode this issue warns about: concluding from a search result instead of from the code.
6. **The phase documents are history, not specification.** Where a phase document and an approved ADR or policy disagree, the ADR or policy wins and the row is marked `superseded`. The phase documents are not updated to match, because rewriting history would destroy the audit trail this matrix depends on.

## What this matrix does not claim

It does not claim any row is secure, accessible, performant, or covered by
tests. A `verified` row means the phase requirement is implemented as written.
The [v1 release checklist](v1-release-checklist.md) carries the gates that
decide whether the product may ship.
