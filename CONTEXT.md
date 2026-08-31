# Domain context

The canonical language of Akomapa Academy. Every issue, commit message,
identifier, comment, and piece of user-facing copy uses these words with these
meanings. Where the code says something different, this file names the drift
and the issue that resolves it.

Product truth is in [PRODUCT.md](PRODUCT.md). Visual decisions are in
[DESIGN.md](DESIGN.md). Architectural seams are in
[docs/adr/](docs/adr/README.md). Approved by Prince Agyei Tuffour (@nanaagyei)
on 2026-08-30 under issue
[#36](https://github.com/akomapahealth/akomapa-lms/issues/36).

## The one rule

**Course contains Modules. A Module contains Topics.** Three levels, no more.
Anything that reads as a fourth level of content hierarchy is a modelling
error, not a new term.

```
Course
└── Module            (ordered by position, optionally owned by a Faculty member)
    ├── Topic         (ordered by position; VIDEO, TEXT, or INTERACTIVE)
    │   ├── MuxData   (video playback, one per video Topic)
    │   └── CaseStudy (at most one per Topic)
    └── Quiz          (MODULE_QUIZ)
└── Quiz              (PRE_TEST, POST_TEST)
└── Attachment        (course-level resources)
```

## Terms

### Learning structure

**Course.** A complete unit of the GHELP curriculum, the thing a learner
enrols in and can be certified for. Carries a nullable `price`; `isPublished`
gates all learner visibility. Prisma: `Course`.

**Module.** An ordered division of a Course, the unit a Faculty member owns and
supervises. Carries an optional `reflectionPrompt` that seeds a Journal Entry.
Publishing is independent of its Course. Prisma: `Module`.

**Topic.** The smallest unit of content a learner completes: a video, a text
page, or an interactive Case Study, selected by `contentType`. `isFree` marks a
Topic previewable without an Enrollment. Prisma: `Topic`, stored in the table
named `Chapter`; see [Legacy terminology](#legacy-terminology).

**Attachment.** A downloadable resource attached to a Course, not to a Module
or Topic. Prisma: `Attachment`.

**Category.** A classification label on a Course, used for discovery only.
Never an access or entitlement concept. Prisma: `Category`.

### People and access

**Learner.** Someone taking a Course. The product word for the `STUDENT` role.
User-facing copy says "learner", never "student user" and never "customer".

**Faculty.** A subject expert who authors and supervises. Owns Modules through
`Module.facultyId`. Role value `FACULTY`. Carries `bio`, `title`, and
`specialization` on `User`.

**Administrator.** Foundation staff running the programme. Role value `ADMIN`.
Every Faculty capability plus learner administration, moderation, and
analytics.

**Role.** Exactly one of `STUDENT`, `FACULTY`, `ADMIN`, persisted on
`User.role` and always resolved on the server through `lib/roles.ts`. A role
never arrives from the browser. `ADMIN` implies `FACULTY`; `FACULTY` does not
imply `ADMIN`. See
[ADR 0001](docs/adr/0001-identity-authentication-and-rbac.md).

**User.** The persisted account. Its `id` is the Clerk user id, so Clerk is the
only identity authority and there is no local password. Prisma: `User`.

**Enrollment.** The canonical entitlement to a Course. If an Enrollment exists
and is `ACTIVE`, the learner has access; if it does not, they do not. Status is
one of `ACTIVE`, `COMPLETED`, `SUSPENDED`. Unique per learner and Course.
Prisma: `Enrollment`. See
[ADR 0002](docs/adr/0002-enrollment-as-canonical-entitlement.md).

**Purchase.** Evidence that a Course was paid for. It is a payment record, not
an entitlement, and no access check may read it directly. Unique per learner
and Course. Prisma: `Purchase`.

### Progress and assessment

**Topic Progress.** Whether one learner has completed one Topic. The atomic
progress fact from which every Course percentage, Module completion, Badge, and
Certificate is derived. Prisma: `UserProgress`, keyed on the Topic. See
[ADR 0004](docs/adr/0004-transactional-completion-and-events.md).

**Quiz.** A set of Questions of exactly one `type`: `PRE_TEST` and `POST_TEST`
belong to a Course, `MODULE_QUIZ` belongs to a Module. Carries an optional
`timeLimitMinutes` and a `passingScore` defaulting to 70. Prisma: `Quiz`.

**Pre-test.** The Quiz taken before a learner works through a Course. It
establishes the baseline that makes measured growth possible and is never
gated on progress.

**Post-test.** The Quiz taken after the Modules of a Course are complete. The
pre-test to post-test delta is the product's primary measure of value; see
[PRODUCT.md](PRODUCT.md#launch-success-criteria).

**Question.** One item in a Quiz, with a `position` and a `points` value.
Prisma: `Question`.

**Question Option.** One selectable answer. `isCorrect` is answer-key data and
must never reach an unauthenticated or in-progress client, and must never be
logged. Prisma: `QuestionOption`.

**Quiz Attempt.** One learner's single run at one Quiz, from `startedAt` to
`completedAt`, carrying the resulting `score` and `totalPoints`. An Attempt
with a null `completedAt` is in progress. Scores are computed on the server
from the persisted Answers; a score supplied by the browser is never trusted.
Prisma: `QuizAttempt`.

**Quiz Answer.** One selected Option within one Attempt. Prisma: `QuizAnswer`.

**Case Study.** An interactive scenario attached to exactly one Topic, with a
JSON `scenario`. Prisma: `CaseStudy`.

**Case Study Attempt.** One learner's run through a Case Study, recording their
`choices`. Prisma: `CaseStudyAttempt`.

### Recognition

**Certificate.** The verifiable artefact issued when a learner completes a
Course. Its `certificateNumber` is unique and publicly checkable at `/verify`
with no account. One per learner and Course. Issuance is derived from
persisted completion, never requested by a client. Prisma: `Certificate`.

**Badge.** A named recognition with machine-readable `criteria` and a `type` of
`COMPLETION`, `STREAK`, `COMMUNITY`, `QUIZ_SCORE`, or `MILESTONE`. Prisma:
`Badge`; the award is `UserBadge`.

**Learning Streak.** Consecutive days of learning activity, holding
`currentStreak`, `longestStreak`, and `lastActivityDate`. It states a fact and
never pressures; see [PRODUCT.md](PRODUCT.md#anti-references). Prisma:
`LearningStreak`.

### Community and reflection

**Community.** The forum as a whole: the product word for every Forum surface.
Copy says "Community", never "forum", even though the models are named
`Forum*`.

**Community Category.** A discussion grouping. Prisma: `ForumCategory`.

**Community Post.** A discussion thread, optionally associated with a Course,
with `isPinned` and `isLocked` moderation flags. Prisma: `ForumPost`.

**Community Comment.** A reply to a Post. Prisma: `ForumComment`. Likes are
`PostLike` and `CommentLike`.

**Journal Entry.** A learner's private reflection, defaulting to
`isPrivate: true`, optionally bound to a Module or Course and seeded by a
Module's `reflectionPrompt`. Journal content is private learner data: it is
never logged, never included in analytics, and never visible to Faculty or
Administrators unless the learner has explicitly made it non-private. Prisma:
`JournalEntry`.

### Platform

**AI Pro.** The paid AI capability. Named here so the term is used
consistently; it is out of scope for v1. See
[PRODUCT.md](PRODUCT.md#ai-pro) and
[ADR 0006](docs/adr/0006-ai-provider-abstraction.md).

**Domain event.** A fact recorded in the same transaction as the state change
that produced it, then delivered at least once by the outbox processor. See
[ADR 0005](docs/adr/0005-transactional-outbox-processing.md).

**Principal.** The authenticated actor a server operation runs as: a user id
and a role, both derived on the server. See
[ADR 0003](docs/adr/0003-rls-and-transaction-scoped-principal.md).

## Legacy terminology

These names exist in storage, routes, or configuration and do not match the
canonical vocabulary. They are read-only history: use the canonical term in
everything new, and do not extend the legacy surface.

| Legacy name | Where it lives | Canonical term | Resolved by |
| --- | --- | --- | --- |
| `Chapter` (table) | `prisma/schema.prisma`, `Topic` is `@@map("Chapter")` | Topic | [#52](https://github.com/akomapahealth/akomapa-lms/issues/52) |
| `chapterId` (column) | `UserProgress.topicId @map("chapterId")`, plus the index names `UserProgress_userId_chapterId_key` and `UserProgress_chapterId_idx` | Topic id | [#52](https://github.com/akomapahealth/akomapa-lms/issues/52) |
| `/chapters` (route) | `app/(course)/courses/[courseId]/chapters/`, `app/api/courses/[courseId]/chapters/` | Topic routes | [#52](https://github.com/akomapahealth/akomapa-lms/issues/52) |
| `teacher` (route group) | `app/(dashboard)/(routes)/teacher/` | Faculty | [#86](https://github.com/akomapahealth/akomapa-lms/issues/86) |
| `TEACHER_ID` (env var) | `lib/roles.ts`, grants `ADMIN` by environment variable | Role on `User` | [#42](https://github.com/akomapahealth/akomapa-lms/issues/42) |
| `StripCustomer` (model) | `prisma/schema.prisma`, a misspelling of Stripe | Stripe customer | [#51](https://github.com/akomapahealth/akomapa-lms/issues/51) |

**Chapter is never learner-facing.** No new UI copy, no new route segment, no
new identifier, no new issue title may use it. Existing occurrences stay until
#52 migrates them, because renaming a table and its indexes is a data change
with its own rollback plan, not a find and replace.

## Naming rules

1. **One word per concept.** Never introduce a synonym for a term above. Not
   "lesson" for Topic, not "unit" for Module, not "class" for Course, not
   "student" in copy where "learner" is meant.
2. **Persisted names may lag; new names may not.** When storage uses a legacy
   name, the surrounding TypeScript, route, and copy still use the canonical
   one, exactly as `Topic` already does over the `Chapter` table.
3. **Entitlement words are reserved.** "Enrolled", "purchased", and "has
   access" are three different statements. Enrollment grants access; Purchase
   records payment; access is the computed result. Never use them
   interchangeably.
4. **Attempt words are reserved.** "Started", "in progress", "submitted",
   "completed", and "passed" each have a defined state; see Quiz Attempt.
5. **Role words are reserved.** "Faculty" and "Administrator" are roles.
   "Teacher", "instructor", "staff", and "moderator" are not terms in this
   domain.
6. **Private means private.** Journal Entry content and unpublished Community
   drafts are private learner data. "Private" is never used loosely to mean
   "not yet shown".

## Invariants

These hold across the whole system. A change that breaks one is a defect, not a
feature.

- The principal and role are derived on the server from the Clerk session. No
  `userId`, role, ownership, price, score, completion, or entitlement value
  from the browser is ever trusted.
- Access to a Course is granted by an `ACTIVE` Enrollment, or by a Topic being
  `isFree`. Nothing else grants access, and a Purchase alone does not.
- A Topic is reachable only through a Module of the Course the learner is
  entitled to. Reaching a Topic through any other Course is a cross-course
  access defect.
- Quiz scores, Module completion, Course completion, Badges, and Certificates
  are computed on the server from persisted state, inside one transaction, and
  cannot be asserted by a client.
- A Certificate exists only where the completion that justifies it exists, and
  its number is unique and permanently verifiable.
- Missing, stale, or contradictory state denies access. Deny by default.
- Answer keys (`QuestionOption.isCorrect`), Journal Entry content, private
  Community content, secrets, tokens, raw payment data, and AI prompts are
  never logged. Telemetry uses correlation ids and safe identifiers.
