-- Backfill: every Purchase gets an Enrollment (#48, ADR 0002).
--
-- ADR 0002 makes Enrollment the only Course entitlement and Purchase evidence of
-- payment. Before this migration, access was read from Purchase at eleven call
-- sites, so a learner who had paid but had no Enrollment row still had access.
-- After the cutover that learner would be locked out of a Course they bought.
-- This closes that gap before the code changes land.
--
-- Idempotent: ON CONFLICT DO NOTHING against the (userId, courseId) unique index,
-- so re-running is a no-op. It also never touches an existing Enrollment, which
-- matters because an existing row may be SUSPENDED or COMPLETED and must not be
-- reset to ACTIVE.
--
-- Rollback: this migration only inserts rows that can be identified exactly --
-- an Enrollment whose (userId, courseId) has a Purchase and whose enrolledAt
-- equals its createdAt from this run. Reversing it is
--
--   DELETE FROM "Enrollment" e
--    USING "Purchase" p
--    WHERE e."userId" = p."userId" AND e."courseId" = p."courseId";
--
-- but that is almost certainly the wrong thing to run: it would also delete
-- Enrollments that legitimately accompany a Purchase. The forward fix is to
-- correct a specific row's status, not to undo the backfill. Access removal is an
-- Enrollment status change, never a deletion (ADR 0002).
--
-- Verification, expected to return 0 after this runs:
--
--   SELECT count(*) FROM "Purchase" p
--    WHERE NOT EXISTS (
--      SELECT 1 FROM "Enrollment" e
--       WHERE e."userId" = p."userId" AND e."courseId" = p."courseId");

INSERT INTO "Enrollment" ("id", "userId", "courseId", "status", "enrolledAt", "createdAt", "updatedAt")
SELECT
  gen_random_uuid(),
  p."userId",
  p."courseId",
  'ACTIVE',
  -- Preserve when the learner actually gained access, rather than stamping the
  -- migration's own clock onto every historical enrolment.
  p."createdAt",
  p."createdAt",
  NOW()
FROM "Purchase" p
ON CONFLICT ("userId", "courseId") DO NOTHING;
