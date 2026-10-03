# Database integrity: deletes, retention, ordering, indexes

What the database guarantees about Akomapa Academy's data, and why. Every
decision here is enforced by a constraint or an index in a committed
migration, not by convention.

- **Issue:** [#51](https://github.com/akomapahealth/akomapa-lms/issues/51)
- **Retention source:** [policy 02](../policies/02-retention-and-deletion.md)
- **Migrations:** `20261003020000_restrict_learner_record_deletes`,
  `20261003030000_unique_positions`, `20261003040000_query_indexes`
- **Preflight:** `npm run db:integrity:preflight`

## Deletes and retention

Every relation in `prisma/schema.prisma` states its `onDelete`. The rule
behind each choice, from policy 02:

- **User rows are never deleted.** An account deletion anonymises the row and
  keeps its id, so foreign keys survive. Every relation to `User` is
  `RESTRICT`. Self-service deletion and export ([#117](https://github.com/akomapahealth/akomapa-lms/issues/117))
  deletes or de-identifies the user's dependent rows explicitly, in a
  transaction, then anonymises the user.
- **Payment and learning records outlive the content they reference.** A
  Course, Topic, Quiz, Question, or Case Study that learners have used cannot
  be deleted, only unpublished.
- **Authored content goes with its parent** when no learner has used it.

| Record | Parent | On parent delete | Why |
| --- | --- | --- | --- |
| `Purchase` | `Course` | **Restrict** | Payment evidence, retained 7 years (policy 02) |
| `Enrollment` | `Course` | **Restrict** | The entitlement and its history (ADR 0002) |
| `Certificate` | `Course` | **Restrict** | Permanently verifiable at `/verify` |
| `UserProgress` | `Topic` | **Restrict** | Learning record; drives completion and Certificates |
| `QuizAttempt` | `Quiz` | **Restrict** | Learning record and grade |
| `QuizAnswer` | `Question`, `QuestionOption` | **Restrict** | Removing either would silently change a grade |
| `CaseStudyAttempt` | `CaseStudy` | **Restrict** | Learning record |
| `QuizAnswer` | `QuizAttempt` | Cascade | Part of the attempt; attempts themselves are restricted |
| `Module`, `Attachment` | `Course` | Cascade | Authored content |
| `Topic` | `Module` | Cascade | Authored content (still blocked by learner progress) |
| `MuxData`, `CaseStudy` | `Topic` | Cascade | Authored content (Mux asset deleted after the row) |
| `Quiz` | `Course`, `Module` | Cascade | Authored content (still blocked by attempts) |
| `Question` | `Quiz` | Cascade | Authored content (still blocked by answers) |
| `QuestionOption` | `Question` | Cascade | Authored content (still blocked by answers) |
| `ForumComment` | `ForumPost`, parent comment | Cascade | A removed post takes its thread (policy 07) |
| `PostLike`, `CommentLike` | post, comment | Cascade | Meaningless without what was liked |
| `ForumPost` | `ForumCategory` | Restrict | Categories are emptied before removal |
| `ForumPost`, `JournalEntry` | `Course` (optional) | Set null | The learner's writing outlives the Course |
| `JournalEntry` | `Module` (optional) | Set null | As above |
| `Course` | `Category` (optional) | Set null | A Course outlives its category |
| `UserBadge` | `Badge` | Restrict | Awarded recognition is not withdrawn by deleting its definition |
| Every user-owned record | `User` | Restrict | User rows are anonymised, never deleted |

**Not here yet:** AI conversation data ([#71](https://github.com/akomapahealth/akomapa-lms/issues/71),
[#73](https://github.com/akomapahealth/akomapa-lms/issues/73); retention 90
days, PENDING LEGAL REVIEW in policy 03), outbox rows
([#69](https://github.com/akomapahealth/akomapa-lms/issues/69)), and
subscriptions ([#72](https://github.com/akomapahealth/akomapa-lms/issues/72)).
Each model states its delete and retention behavior in its own first
migration and adds its row to this table. **Soft-delete:** no model is
soft-deleted today. Policy 02 refers to Courses being "archived". Until an
archive state exists, unpublishing is the way to retire content learners have
used.

### How a refused delete looks

The routes check `lib/courses/learner-records.ts` first and answer **409
`conflict`** with a reason and the alternative ("Unpublish it instead").
RESTRICT is the backstop for a race between that check and the delete;
`handleRouteError` answers a delete refused by RESTRICT as 409 too, never 422.

External cleanup follows the database. The Course and Topic routes delete the
row first and the Mux asset afterwards (`lib/courses/mux-cleanup.ts`), so a
refused delete never leaves live content without its video. A failed Mux
delete is logged as `<TAG>_MUX_CLEANUP` with the asset id: an orphaned asset
to remove by hand, never a failed request.

## Ordering

Modules (per Course), Topics (per Module), Questions (per Quiz), and Question
options (per Question) are unique by position.

- **Reorders** park rows at temporary positions above `NUMBER.maxPosition`
  before writing final positions, in one transaction (`applyPlacements` in
  `lib/courses/ordering.ts`). A final position held by a sibling the request
  did not list is refused by the unique index, and the reorder rolls back as
  409.
- **Creates** read "last position + 1" and retry up to three times if a
  concurrent create takes it (`withPositionRetry`). The default "General"
  Module takes the next free position.
- **Payloads** with two rows at one position are refused with
  `duplicate_position` / `duplicate_option_position`.
- **The migration** renumbered only the parents that already held duplicates,
  keeping their relative order (position, then `createdAt`, then id) and their
  lowest position. Parents without duplicates kept their gaps.

`ForumCategory.position` is not unique. Categories default to 0 and are listed
by position; it is a display hint an administrator sets, not a sequence the
application maintains.

## Indexes

Each index serves a query the application runs. `tests/integration/query-plans.test.ts`
plans every row below with sequential scans disabled and asserts PostgreSQL
uses the listed index, so this table cannot silently drift from the schema.

| Query | Index | Issued by |
| --- | --- | --- |
| Course owned by the principal | `Course_pkey` | `lib/auth/guards.ts` |
| Learner's Enrollment for a Course | `Enrollment_userId_courseId_key` | `lib/entitlement/course.ts` |
| Learner's progress on a Topic | `UserProgress_userId_chapterId_key` | progress route, `actions/get-progress.ts` |
| Certificate verification by number | `Certificate_certificateNumber_key` | `/verify/[certificateNumber]` |
| Learner's Certificate for a Course | `Certificate_userId_courseId_key` | `lib/certificate-service.ts` |
| Learner's enrolled Courses | `Enrollment_userId_courseId_key` | `entitledCourseIds` in `lib/entitlement/course.ts` |
| Learner's completed Topics | `UserProgress_userId_chapterId_key` | `actions/get-progress.ts`, `lib/badge-service.ts` |
| Modules of a Course, in order | `Module_courseId_position_key` | course pages, `actions/get-learning-path.ts` |
| Topics of a Module, in order | `Chapter_moduleId_position_key` | course sidebar, Topic navigation |
| Questions of a Quiz, in order | `Question_quizId_position_key` | Quiz start and results routes |
| Options of a Question, in order | `QuestionOption_questionId_position_key` | Quiz start and results routes |
| Best completed attempt per learner per Quiz | `QuizAttempt_userId_quizId_idx` | `actions/check-post-test-lock.ts`, `lib/certificate-service.ts` |
| Learner's badges | `UserBadge_userId_badgeId_key` | `actions/get-user-badges.ts`, `lib/badge-service.ts` |
| Learner's journal, most recent first | `JournalEntry_userId_updatedAt_idx` | `actions/get-journal-entries.ts` |
| Community feed, newest first | `ForumPost_createdAt_idx` | `actions/get-forum-posts.ts` |
| Pinned posts, newest first | `ForumPost_isPinned_createdAt_idx` | `actions/get-forum-posts.ts` |
| A member's posts, newest first | `ForumPost_userId_createdAt_idx` | community profile page |
| Posts in a category | `ForumPost_categoryId_idx` | category routes, `actions/get-forum-posts.ts` |
| Comments on a post | `ForumComment_postId_idx` | post page |
| Likes on a post | `PostLike_postId_idx` | like route, `lib/badge-service.ts` |
| An author's Courses, newest first | `Course_userId_createdAt_idx` | teacher courses page |
| Admin student list, newest first | `User_role_createdAt_idx` | admin students page |
| Enrollments of a Course | `Enrollment_courseId_idx` | analytics, `lib/courses/learner-records.ts` |
| Attempts on a Quiz | `QuizAttempt_quizId_idx` | analytics, `lib/courses/learner-records.ts` |
| Progress on a Topic | `UserProgress_chapterId_idx` | `lib/courses/learner-records.ts` |
| Enrolments in a period | `Enrollment_enrolledAt_idx` | `actions/get-admin-analytics.ts` |
| Completed attempts in a period | `QuizAttempt_completedAt_idx` | `actions/get-admin-analytics.ts` |
| Topic completions in a period | `UserProgress_isCompleted_updatedAt_idx` | `actions/get-completion-timeline.ts` |
| Expired rate-limit buckets | `RateLimitBucket_expiresAt_idx` | `lib/rate-limit/store.ts` |

**Removed as redundant:** `UserBadge_userId_idx` and `Certificate_userId_idx`
(each unique index's leading column serves lookups by `userId`), and the
single-column `QuizAttempt_userId_idx`, `ForumPost_userId_idx`, and
`JournalEntry_userId_idx` (replaced by the wider indexes above). The
single-column indexes on `Module.courseId`, `Chapter.moduleId`,
`Question.quizId`, and `QuestionOption.questionId` went with the ordering
migration, covered by its unique indexes.

**Deliberately unindexed:** `Course` filters on `isPublished` and `categoryId`.
The catalogue is a few dozen Courses, where an index costs more than it saves.
Revisit if the catalogue grows past a few thousand.

**Adding an index on a large table:** Prisma applies migrations in a
transaction, which forbids `CREATE INDEX CONCURRENTLY`. Create the index
concurrently by hand first; the migration's `CREATE INDEX` then needs
`IF NOT EXISTS`.

## Before deploying

```sh
DIRECT_URL='postgresql://…' npm run db:integrity:preflight
```

Read-only. It reports duplicate positions (which the ordering migration will
renumber), plus anything the integrity constraints would refuse. Exit 0 means
clean, 1 means findings are listed, 2 means it could not run.

## Rollback

Forward-fix is preferred. Each migration's inverse:

- **`20261003020000_restrict_learner_record_deletes`.** For each of the eight
  constraints, drop it and re-create it with its previous action:
  `ON DELETE CASCADE` for `Purchase_courseId_fkey`, `Enrollment_courseId_fkey`,
  `UserProgress_chapterId_fkey`, `QuizAttempt_quizId_fkey`,
  `QuizAnswer_questionId_fkey`, and `CaseStudyAttempt_caseStudyId_fkey`;
  `ON DELETE SET NULL` for `QuizAnswer_selectedOptionId_fkey` and
  `Module_facultyId_fkey`. Rolling this back re-opens the defect (deleting
  content erases payments and grades), so do it only alongside a code rollback.
- **`20261003030000_unique_positions`.** Drop the four `*_position_key` unique
  indexes and re-create `Module_courseId_idx`, `Chapter_moduleId_idx`,
  `Question_quizId_idx`, and `QuestionOption_questionId_idx`. The renumbering
  is not reverted; the previous order was ambiguous.
- **`20261003040000_query_indexes`.** Drop the ten new indexes and re-create
  the five dropped ones. Indexes change performance, never results.

Then run `npx prisma migrate resolve --rolled-back <name>` for each migration
rolled back.
