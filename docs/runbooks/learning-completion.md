# Learning completion and domain events

How a learner completing content becomes progress, completion, badges, streaks,
Certificates, and recorded events, all in one transaction, and how to operate
it.

- **Issue:** [#49](https://github.com/akomapahealth/akomapa-lms/issues/49)
- **Decision:** [ADR 0004](../adr/0004-transactional-completion-and-events.md);
  delivery is [ADR 0005](../adr/0005-transactional-outbox-processing.md) /
  [#69](https://github.com/akomapahealth/akomapa-lms/issues/69)
- **Code:** `lib/courses/complete-topic.ts` (the command),
  `lib/courses/completion.ts` (the rules), `lib/outbox/events.ts` (recording),
  `lib/outbox/handlers.ts` (consumers)
- **Migration:** `20261004000000_outbox_events`

## The command

`setTopicCompletion(principal, courseId, topicId, isCompleted)` is the only way
a Topic becomes complete or incomplete. The progress route is a thin boundary
over it. In one transaction it:

1. takes a lock for this learner in this Course (`pg_advisory_xact_lock`), so
   the learner's completions in that Course run one at a time;
2. stops, writing and recording nothing, if the Topic is already in the
   requested state;
3. writes the progress row and records `TOPIC_COMPLETED` or `TOPIC_UNCOMPLETED`;
4. on completion only: decides Module and Course completion from **eligible
   content**, meaning published Topics in published Modules. Both rules are
   non-vacuous: an empty Module or Course is never complete, and an empty
   Module neither blocks nor causes Course completion;
5. advances the streak, promotes an `ACTIVE` Enrollment to `COMPLETED`, reserves
   the Certificate row and its number, and awards badges;
6. records an event for every fact in step 5.

Every write commits together or none does. A failure at any step leaves no
progress, no completion, no Certificate, and no events, and the learner can
retry.

**Uncompleting** changes only the Topic. A completed Course, its Certificate,
and earned Badges are history: the Enrollment transition table forbids
`COMPLETED -> ACTIVE`.

**Who can complete:** the Topic must be published in this Course and readable
by the learner. A suspended learner gets `not_found`. A preview learner can
complete free Topics, but never the Course, because only an `ACTIVE` Enrollment
is promoted.

Quiz submission and Community post and comment creation follow the same rule:
the write, its badges, and their events commit together.

## Events

Identifiers only, never content (ADR 0005 point 6). Payload schemas are
`.strict()` and validated before anything is written.

| Event | Aggregate | Recorded | Consumer |
| --- | --- | --- | --- |
| `TOPIC_COMPLETED` | Enrollment `userId:courseId` | Each completion (state change only) | none yet |
| `TOPIC_UNCOMPLETED` | Enrollment | Each uncompletion | none yet |
| `MODULE_COMPLETED` | Enrollment | Once per learner per Module | none yet |
| `COURSE_COMPLETED` | Enrollment | Once per learner per Course | none yet |
| `CERTIFICATE_ISSUED` | Certificate | Once per Certificate | Renders and stores the PDF |
| `BADGE_AWARDED` | UserBadge | Once per learner per Badge | none yet |
| `QUIZ_ATTEMPT_COMPLETED` | QuizAttempt | Once per attempt | none yet |

"Once" is enforced by `OutboxEvent.dedupeKey`. "None yet" is explicit in
`EVENT_HANDLERS`: there is no email capability (policy 05) and no analytics
pipeline, so these events are recorded and wait for a consumer. Adding one is
a handler in `lib/outbox/handlers.ts`, idempotent and tested by delivering the
same event twice.

## Until the processor exists (#69)

Events are recorded but nothing delivers them yet, so `OutboxEvent` rows
accumulate with `completedAt` NULL. This is expected and bounded: a few rows
per Topic completed. #69 adds the processor, retention, and replay tooling.

Certificate PDFs keep working in the meantime. The completion transaction
reserves the row and number, and the PDF is rendered the first time the
learner opens their Certificate (`/api/courses/[courseId]/certificate`), from
the stored number. When #69 delivers `CERTIFICATE_ISSUED`, the PDF will be
ready before the learner asks; either path renders it once.

## Operations

**Signals.**

- A failed command answers 500 and logs `CHAPTER_ID_PROGRESS` (or
  `QUIZ_SUBMIT`, `COMMUNITY_POSTS_POST`) with a correlation id. Nothing is half
  written, so the learner can retry.
- A command waits at most 5 s for a database connection and runs at most 15 s.
  Lock waits only queue a learner behind their own requests in the same Course,
  so a timeout means a slow database, not contention.
- Once #69 lands: outbox depth, oldest undelivered event, and parked rows. Its
  runbook sets thresholds; #102 turns them into alerts.

**Alert thresholds** (as log queries until #102):

| Signal | Threshold | Meaning |
| --- | --- | --- |
| `CHAPTER_ID_PROGRESS` errors | More than 1% of progress requests over 15 minutes | Completions are failing; investigate the database first |
| Transaction timeouts (Prisma `P2028`) in completion logs | Any sustained | The database is slow enough that a 15 s command does not finish |
| Undelivered `OutboxEvent` rows older than a day | Any, once #69 is live | The processor is not running or is parked |

**Repair.** Derived state is a function of persisted rows (ADR 0004), so it
can be recomputed rather than edited. Take a learner whose progress shows every
eligible Topic complete while their Enrollment is still `ACTIVE`, for example
after a Topic was unpublished. Uncompleting and re-completing any one of their
Topics re-runs the derivation: it promotes the Enrollment and reserves the
Certificate in one commit, and records the missing events. Never write
`Enrollment.status` or a `Certificate` row by hand.

## Rollback

Revert the code. The `OutboxEvent` table and enum can stay: the previous code
does not write to them. To remove them, deploy the previous release, then
`DROP TABLE "OutboxEvent"; DROP TYPE "DomainEventType";` and run
`npx prisma migrate resolve --rolled-back 20261004000000_outbox_events`.
