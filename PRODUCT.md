# Product

<!-- impeccable:product-schema 1 -->

Source of truth for who Akomapa Academy serves, what it promises, and which
product facts future work must preserve. Visual decisions live in
[DESIGN.md](DESIGN.md); domain language lives in [CONTEXT.md](CONTEXT.md);
architectural seams live in [docs/adr/](docs/adr/README.md).

Approved by Prince Agyei Tuffour (@nanaagyei) on 2026-08-30 under issue
[#36](https://github.com/akomapahealth/akomapa-lms/issues/36). Anything not
settled is listed under [Open decisions](#open-decisions) with a linked issue.
Nothing in this file may be inferred, extended, or overridden without a new
approval recorded here.

## Platform

web

## Register and Modes

Primary register: **product**. Design serves the work of learning; it is not
the product itself.

Impeccable v4 replaces a single register with a per-surface mode. The modes
below are binding for the route groups named:

| Surface | Route group | Mode | Success looks like |
| --- | --- | --- | --- |
| Marketing site | `app/(marketing)/` | Persuade | A prospective learner understands GHELP and enrols |
| Authenticated app | `app/(dashboard)/` | Operate | A learner or staff member completes the task they came for |
| Course player | `app/(course)/` | Operate | A learner finishes a Topic and knows what comes next |
| Certificate verification | `app/verify/` | Read | A third party confirms a Certificate is genuine in seconds |
| Legal and policy pages | `app/(marketing)/privacy`, `app/(marketing)/terms` | Read | A reader finds the clause they need |

Choose the mode from the surface being worked on, never from the product as a
whole. The marketing site being Persuade does not license persuasion patterns
inside the app.

## Users

**Primary: global and diaspora health learners.** Students and early-career
practitioners in medicine, nursing, pharmacy, public health, and allied health,
based across West Africa, North America, and elsewhere, who take GHELP as
global health training. Ghana is the mission origin and the operational home of
the Akomapa Health Foundation, not a market boundary. They arrive with real
clinical or academic workloads and study GHELP in the gaps: evenings, commutes,
between rotations. They are peers and future leaders, never beneficiaries.

Their job: build and prove ethically grounded, community rooted global health
leadership capability, and hold evidence of it that someone else can verify.

**Secondary audiences, each with a distinct job:**

- **Health professionals.** Practising clinicians and public health workers
  using GHELP for continuing education. Same learner surfaces, but they arrive
  with prior knowledge and care most about the pre-test to post-test delta and
  the Certificate.
- **Faculty.** Subject experts who author and supervise. Their job is to
  publish accurate Modules and Topics, set Quizzes, and see whether learners
  actually understood. They own content, not learners.
- **Administrators.** Foundation staff running the programme. Their job is to
  keep cohorts moving, moderate the Community, resolve access and payment
  problems, and answer "is this working" with evidence.

`STUDENT`, `FACULTY`, and `ADMIN` are the persisted role values
(`lib/roles.ts`). "Learner" is the product word for `STUDENT`; see
[CONTEXT.md](CONTEXT.md).

## Product Purpose

Akomapa Academy is the digital home of the Akomapa Global Health Education and
Leadership Program (GHELP), operated by the Akomapa Health Foundation, a
501(c)(3) nonprofit. It delivers a curated ten course curriculum that trains
people to lead community rooted, ethically grounded healthcare.

The guiding idea is *Nya Akomapa*, "have a good heart."

The product does three things in sequence, and every feature must serve one of
them:

1. **Teach.** A structured pathway of Courses, Modules, and Topics with video,
   text, and Case Studies.
2. **Measure.** Pre-tests and post-tests quantify what a learner actually
   gained, per Course. Growth is the unit of value, not hours watched.
3. **Certify.** A Certificate with a unique number that anyone can verify at
   `/verify` without an account.

Community, Journal, Badges, and Learning Streaks exist to sustain the first
three. They are not the product.

### v1 outcomes

- A learner can discover a Course, enrol, work through Modules and Topics,
  take a pre-test and post-test, and receive a verifiable Certificate, without
  encountering an integrity, access, or accessibility defect.
- Faculty can author and publish a Course without an administrator writing SQL.
- Administrators can answer enrolment, engagement, and outcome questions from
  the analytics surface rather than the database.
- Every entitlement, score, completion, and Certificate is derived server side
  and cannot be forged from the browser.

### Launch success criteria

Measured over the first full cohort after the `v1.0.0 Production Ready`
milestone closes. Thresholds marked *open* are unset and tracked in
[Open decisions](#open-decisions).

| Signal | Measure | Threshold |
| --- | --- | --- |
| Measured knowledge growth | Mean post-test minus pre-test score across learners who complete a Course | Positive and statistically meaningful; exact target *open* |
| Course completion | Learners who complete every published Module in an enrolled Course | *open* |
| Certificates issued and verified | Certificates issued, and distinct successful `/verify` lookups | *open* |
| Cohort activation | Share of enrolled learners reaching Module 2 | *open* |
| Retention | Share of active learners returning within a 7 day window (Learning Streak activity) | *open* |
| Operational trust | Production authorization, entitlement, or Certificate forgery defects | Zero |
| Quality gates | Lint, type, build, security scan, accessibility, and integration gates on the release build | All green, no waived required check |

The four operational and quality rows are release blockers. The engagement rows
are launch health signals and do not block the release on their own.

## Positioning

GHELP is one curated curriculum with named expert supervision, not a catalogue.
The differentiating mechanism is the **measured growth loop**: a pre-test that
establishes a baseline before any teaching, the same domain assessed again
after, and a Certificate whose number a third party can check without an
account or a login. A course marketplace cannot truthfully copy this, because
its incentive is enrolments, not demonstrated gain, and its certificates
attest to attendance rather than change.

The second differentiator is *student-powered, expert-supervised*: learners are
treated as future leaders who will supervise others, which is why the Community
and Journal are first-class rather than support features.

## Operating Context

Connectivity and device reality is **genuinely split**, and DESIGN.md carries
two floors:

- **Learner surfaces** (`app/(marketing)/`, `app/(dashboard)/`,
  `app/(course)/`, `app/verify/`): mobile first. The design floor is a mid
  range Android phone on intermittent mobile data. Pages must be readable and
  navigable before video or images resolve. Video must degrade rather than
  block. Losing a connection mid Quiz must never cost a learner their attempt;
  autosave, reconnection, and abandonment behaviour are owned by
  [#64](https://github.com/akomapahealth/akomapa-lms/issues/64).
- **Faculty and administrator surfaces** (`app/(dashboard)/(routes)/admin/`,
  `app/(dashboard)/(routes)/teacher/`): desktop primary on reliable
  connections, with dense tables and authoring tools. They remain responsive
  and keyboard operable, but the mobile phone is not their design floor.

Learners study in fragmented sessions and expect to resume exactly where they
stopped. Staff work in longer focused sessions.

## Capabilities and Constraints

**Confirmed capabilities.** Ten Course GHELP pathway with a guided learning
path; Course player with Mux hosted video, text Topics, Case Studies, and
attachments; Quizzes with pre-test and post-test types, attempts, and grading;
grades across enrolled Courses; Community forum with categories, posts, and
threaded comments; private reflection Journal; Badges and Learning Streaks;
PDF Certificates with public verification at `/verify`; admin console for
Courses, learners, Quizzes, and moderation; analytics; Course and Topic
authoring with drag and drop ordering and a rich text editor; light and dark
themes.

**Technical constraints.** Next.js 16 App Router on React 18; Clerk is the only
identity source; PostgreSQL via Prisma 7; Stripe for payment; Mux for video;
UploadThing for files; Vercel for hosting with native Git deploys;
semantic-release from `main`. The principal and role are always derived on the
server; no `userId`, role, ownership, price, score, completion, or entitlement
value from the browser is ever trusted.

**Terminology.** Course, Module, Topic, Enrollment, Quiz, Quiz Attempt,
Community, Journal Entry, Learning Streak, Badge, Case Study, Certificate,
Faculty, Administrator, Learner, AI Pro. `Chapter` is legacy storage and route
terminology only. Definitions and invariants are in
[CONTEXT.md](CONTEXT.md).

### Paid and free boundary

**Model: per-Course purchase.** Approved 2026-08-30.

- A `Course` carries a `price`. Access to a paid Course is granted by an
  `Enrollment`; a `Purchase` is payment evidence, never the entitlement itself.
  See [ADR 0002](docs/adr/0002-enrollment-as-canonical-entitlement.md).
- A `Topic` marked `isFree` is previewable without an Enrollment. Free preview
  Topics are the only paid Course content visible to a signed out or
  unenrolled visitor.
- The Certificate for a Course is included in that Course's purchase. There is
  no separate certificate fee.
- Community, Journal, Badges, and Learning Streaks are available to every
  authenticated learner and are not gated by purchase.
- `/verify` is public and unauthenticated, permanently.

**Open:** actual price points, currency, regional or scholarship pricing, and
refund policy. See [Open decisions](#open-decisions). No document, seed, or
fixture may assume a price.

### AI Pro

AI Pro is a committed future capability and is **out of scope for v1**. No AI
feature ships in the v1.0.0 release. The only v1 obligation is that the
provider seam and kill switch are designed so Wave 6 does not require reworking
entitlement or logging boundaries. See
[ADR 0006](docs/adr/0006-ai-provider-abstraction.md), status Proposed, gated on
issues #70, #78, and #79. Purchased Course access must never depend on AI
subscription state.

## Brand Commitments

**Name and identity.** "Akomapa Academy", short form "Akomapa". Operated by the
Akomapa Health Foundation. Canonical brand metadata lives in
`lib/site-config.ts` and must not be duplicated in components.

**Voice.** Warm, plain, and direct. Speaks to a colleague, not a customer and
not a student being managed. Explains rather than exhorts. Uses "you" for the
learner and names the Foundation as "we" only where the Foundation is genuinely
the actor.

**Tone by surface.** Persuade surfaces may be aspirational but never
promotional. Operate surfaces are quiet and factual: the interface should
recede so the material is what the learner remembers. Read surfaces are
precise. Errors are honest about what happened and what the person can do next,
and never blame the user.

**Binding phrases.** *Nya Akomapa*, "have a good heart", is the guiding idea and
may be used with its translation. "Student-powered, expert-supervised"
describes the programme. Neither may be restated into slogans.

**Fixed assets.** Logo and wordmark in `public/logo/`; landing media in
`public/landing/`. Fraunces (display) and Outfit (sans) via `next/font`.

### Anti-references

What Akomapa Academy must never feel like. Each is a rejection of a pattern,
not of a company.

- **Not a MOOC marketplace.** No catalogue sprawl, star ratings, "bestseller"
  badges, countdown discounts, enrolment-count social proof, or
  instructor-as-influencer framing. GHELP is one curated curriculum, not a
  store. A visitor should never be asked to compare Courses as products.
- **Not gamified consumer edtech.** Badges and Learning Streaks recognise
  effort; they never manufacture it. No mascots, no guilt copy, no loss-aversion
  nudges, no notification pressure, no streak-break shaming. If a mechanic
  works only by making someone anxious, it does not ship.
- **Not clinical enterprise software.** No dense grey chrome, no jargon-first
  labels, no institutional coldness, no screens that assume training before
  use. A platform that teaches people to lead with a good heart cannot itself
  feel like an EHR.
- **Not aid-sector charity framing.** No deficit narratives, no saviour tone,
  no "helping the underserved", no stock photography of grateful patients.
  Learners are peers and future leaders. Photography and copy show people
  working, not people receiving.

## Evidence on Hand

Real and usable: the Akomapa Health Foundation is a genuine 501(c)(3) with
offices in Accra, Ghana and New Haven, Connecticut (`lib/site-config.ts`); the
ten Course GHELP curriculum; brand assets in `public/logo/` and
`public/landing/`; a working Certificate verification surface at `/verify`;
implementation history in `docs/phase-1.md` through `docs/phase-5.md`.

Absent, and never to be fabricated: learner testimonials, named alumni,
enrolment or completion counts, outcome statistics, partner or accreditation
claims, press coverage, pricing, and any figure in the marketing stats band
that is not sourced from production data. Where the marketing site needs a
number it does not have, the number is omitted, not invented.

## Product Principles

1. **Growth is the unit of value.** Every feature must make measured learning
   gain more likely, more visible, or more trustworthy. Time on platform is not
   a goal.
2. **The learner is a colleague.** Address people as future leaders. Never
   coerce, shame, or condescend, in copy, mechanics, or imagery.
3. **Trust is derived, never asserted.** Entitlements, scores, completions, and
   Certificates are computed on the server from persisted state, deny by
   default, and are verifiable by a third party where they make a public claim.
4. **The interface recedes.** On Operate surfaces the material is what a
   learner should remember. Restraint is the house style; expression lives in
   precise details, not decoration.
5. **Reachable beats impressive.** A feature that fails on a mid range phone
   on poor data has failed for the primary audience, whatever it looks like on
   a laptop.

## Accessibility & Inclusion

**Baseline: WCAG 2.2 AA**, binding for every surface. Accessibility is part of
feature completion, not a later pass: keyboard operation, visible focus,
accessible names and labels, status announcements, responsive reflow, 200%
zoom, target size, and reduced motion are verified with the feature that
introduces them.

Product-specific needs that follow from the audience:

- Learners study on shared and low-cost devices; the interface must remain
  usable at 200% zoom and in bright ambient light.
- Content must not rely on colour alone to convey Quiz correctness, progress,
  or status. See DESIGN.md's accessible state vocabulary.
- Motion respects `prefers-reduced-motion`. No animation is load bearing.
- English is the only supported language in v1. Copy is written so it survives
  translation later: no idiom, no wordplay that depends on English.

Intentional exceptions require the approval process recorded in DESIGN.md.

## Open decisions

Every unresolved product decision, with the issue that owns it. No agent may
resolve one of these by inference.

| Decision | Owner issue |
| --- | --- |
| Course price points, currency, regional and scholarship pricing, refund policy | [#114](https://github.com/akomapahealth/akomapa-lms/issues/114) |
| Numeric thresholds for completion, certificates, activation, and retention success criteria | [#115](https://github.com/akomapahealth/akomapa-lms/issues/115) |
| Privacy, educational safety, support, retention, and incident policies | [#38](https://github.com/akomapahealth/akomapa-lms/issues/38) |
| AI architecture, threat model, safety rubric, and evaluation dataset | [#70](https://github.com/akomapahealth/akomapa-lms/issues/70) |
| Final human visual sign-off | [#101](https://github.com/akomapahealth/akomapa-lms/issues/101) |

## Approvals

| Area | Approver | Date |
| --- | --- | --- |
| Users, purpose, positioning, operating context | Prince Agyei Tuffour (@nanaagyei) | 2026-08-30 |
| Paid and free boundary (model, not prices) | Prince Agyei Tuffour (@nanaagyei) | 2026-08-30 |
| Launch success signals (thresholds open) | Prince Agyei Tuffour (@nanaagyei) | 2026-08-30 |
| Anti-references and brand tone | Prince Agyei Tuffour (@nanaagyei) | 2026-08-30 |
| Accessibility baseline (WCAG 2.2 AA) | Prince Agyei Tuffour (@nanaagyei) | 2026-08-30 |
| AI Pro out of v1 scope | Prince Agyei Tuffour (@nanaagyei) | 2026-08-30 |
