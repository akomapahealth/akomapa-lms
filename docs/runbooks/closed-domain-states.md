# Closed domain states: migration, preflight, and rollback

How the six free-text state columns became PostgreSQL enums, how to check a
database before the migration runs, what to do if it aborts, and how to roll
it back.

- **Issue:** [#50](https://github.com/akomapahealth/akomapa-lms/issues/50)
- **Migration:** `prisma/migrations/20261003010000_closed_domain_states/migration.sql`
- **Canonical values:** `lib/domain/states.ts`
- **Preflight:** `npm run db:states:preflight`
- **Rollback:** `scripts/sql/rollback-20261003010000-closed-domain-states.sql`

## What changed

| Column (database name) | Enum | Values | Default |
| --- | --- | --- | --- |
| `User.role` | `UserRole` | `STUDENT`, `FACULTY`, `ADMIN` | `STUDENT` |
| `Chapter.contentType` (Topic) | `TopicContentType` | `VIDEO`, `TEXT`, `INTERACTIVE` | `VIDEO` |
| `Enrollment.status` | `EnrollmentStatus` | `ACTIVE`, `COMPLETED`, `SUSPENDED` | `ACTIVE` |
| `Quiz.type` | `QuizType` | `PRE_TEST`, `POST_TEST`, `MODULE_QUIZ` | none |
| `Badge.type` | `BadgeType` | `COMPLETION`, `STREAK`, `COMMUNITY`, `QUIZ_SCORE`, `MILESTONE` | none |
| `UserSettings.theme` | `ThemePreference` | `light`, `dark`, `system` | `light` |

Every value is the same string the text column held, so each row converts to
itself. `Badge.criteria` is JSON and cannot be a database enum. Its rules are
validated by a discriminated union in `lib/badge-service.ts`, and a badge whose
criteria fail validation is never awarded.

**Deliberately not here:**

- **Quiz attempt status.** There is no column for it; an attempt is in
  progress until `completedAt` is set. The attempt state machine is
  [#63](https://github.com/akomapahealth/akomapa-lms/issues/63).
- **Subscription and outbox state.** Their models do not exist yet. They are
  enums from their first migration
  ([#72](https://github.com/akomapahealth/akomapa-lms/issues/72),
  [#69](https://github.com/akomapahealth/akomapa-lms/issues/69)); `CONTEXT.md`
  records the invariant.

## How the migration works

Hand-written, because `prisma migrate diff` proposes `DROP COLUMN` plus
`ADD COLUMN` for each column, which would discard every value. The integration
suite proves that version fails. The real migration runs in one transaction,
so the database ends either fully converted or exactly as it was:

1. **Expand.** Create the six enum types.
2. **Verify.** Profile every column and, if any row holds a value outside its
   set (including NULL), raise an error listing each column, value, and row
   count. Nothing is trimmed, case-folded, or defaulted.
3. **Contract.** `ALTER COLUMN ... TYPE ... USING col::"Enum"`, dropping and
   restoring each default around the cast.

### The deploy window

`npm run build` runs `prisma migrate deploy` before the new code serves
traffic, so for a few minutes the previous release writes to the converted
columns. That is safe: the previous client sends these values as untyped
parameters, which PostgreSQL casts to the enum, and it only ever writes valid
values. `tests/integration/closed-states.test.ts` proves untyped writes work
and invalid ones are refused.

## Before deploying: preflight

Run the read-only profile against the target database with the migration role:

```sh
DIRECT_URL='postgresql://…' npm run db:states:preflight
```

- **Exit 0, "clean":** every value is in its set. Deploy.
- **Exit 1:** it lists each unexpected value with a row count. The migration
  would abort. Resolve each value first (below).
- **Exit 2:** it could not connect or query. Check the connection string; quote
  it in single quotes so a `$` in the password is not expanded.

Production at the #48 cutover (2026-09-30) held one `User` and no Courses,
Enrollments, or Quizzes. Expect a clean report, but run it anyway.

## If the migration aborts

The build fails with Prisma error `P3018` and a message like:

```
closed_domain_states: unexpected legacy values; nothing was changed.
  User.role = 'teacher' (1 rows)
```

Nothing changed. The previous deployment keeps serving. To proceed:

1. **Decide each value explicitly.** This is a judgement, not a mechanical fix.
   A lowercase `admin` might be an ADMIN, or might be a hand-edit that should
   never have granted anything. For roles and Enrollment status especially, the
   safe resolution is the *least* privileged value unless someone can vouch for
   more: `STUDENT` for a role, `SUSPENDED` for a status. Record who decided and
   why in the deploy's PR or incident note.
2. Apply the decision with the migration role, for example:
   ```sql
   UPDATE "User" SET role = 'STUDENT' WHERE role = 'teacher';
   ```
3. Re-run the preflight until it is clean.
4. Clear the failed migration record so it can run again:
   ```sh
   npx prisma migrate resolve --rolled-back 20261003010000_closed_domain_states
   ```
5. Redeploy.

**Abort criteria for the rollout:** any unexpected value in `User.role` or
`Enrollment.status` that nobody can account for is an incident, not a cleanup:
something wrote outside the validated paths. Investigate under
[policy 06](../policies/06-incident-response.md) before resolving it.

## After deploying

```sh
DIRECT_URL='postgresql://…' npm run db:states:preflight   # always clean now
npm run db:roles                                            # runtime role still has access
```

The preflight can no longer find anything: the database refuses an
out-of-set value with error `22P02`.

## Rollback

Prefer a forward fix. The previous release's client works against the enum
columns (see the deploy window above), so rolling back the *code* needs no
database change. Roll back the *schema* only if the enums themselves must go:

1. Deploy the previous release first. This release's client expects the
   enum types.
2. Run the rollback with the migration role:
   ```sh
   psql "$DIRECT_URL" -v ON_ERROR_STOP=1 \
     -f scripts/sql/rollback-20261003010000-closed-domain-states.sql
   ```
   It converts each column back to `TEXT` with its original default, value for
   value, and drops the six types. Lossless: the integration suite runs it and
   compares every row.
3. Mark the migration rolled back so a later deploy can re-apply it:
   ```sh
   npx prisma migrate resolve --rolled-back 20261003010000_closed_domain_states
   ```

## Adding a value or a new closed set

1. Add the value to the enum in `prisma/schema.prisma`, and write the migration
   (`ALTER TYPE "X" ADD VALUE 'NEW'` for a new value; a new enum for a new set).
   Never let Prisma drop and re-add a column that holds data.
2. Run `npm run typecheck`. Every exhaustive map in `lib/domain/states.ts`
   (labels, transitions) fails to compile until it handles the new value. Fill
   them in.
3. For Enrollment status, add the value's transitions to
   `ENROLLMENT_TRANSITIONS`, and decide deliberately whether it grants access.
4. CI's drift check (`npm run db:migrations:drift`) fails if the migration does
   not produce exactly the schema.
