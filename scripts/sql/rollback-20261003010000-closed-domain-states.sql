-- Rollback for migration 20261003010000_closed_domain_states (#50).
--
-- Restores the six enum columns to TEXT with their original defaults, value for
-- value, and drops the enum types. Lossless: every enum value is the same
-- string the text column held before the migration.
--
-- Forward-fix is preferred. Use this only with the previous release deployed,
-- because this release's client expects the enum types. Run as the migration
-- role (DIRECT_URL), then mark the migration rolled back so a later deploy can
-- re-apply it:
--
--   psql "$DIRECT_URL" -v ON_ERROR_STOP=1 -f scripts/sql/rollback-20261003010000-closed-domain-states.sql
--   npx prisma migrate resolve --rolled-back 20261003010000_closed_domain_states
--
-- tests/integration/closed-states.test.ts runs this file against a migrated
-- database and checks every value survives the round trip.

BEGIN;

ALTER TABLE "User"
  ALTER COLUMN "role" DROP DEFAULT,
  ALTER COLUMN "role" TYPE TEXT USING "role"::text,
  ALTER COLUMN "role" SET DEFAULT 'STUDENT';

ALTER TABLE "Chapter"
  ALTER COLUMN "contentType" DROP DEFAULT,
  ALTER COLUMN "contentType" TYPE TEXT USING "contentType"::text,
  ALTER COLUMN "contentType" SET DEFAULT 'VIDEO';

ALTER TABLE "Enrollment"
  ALTER COLUMN "status" DROP DEFAULT,
  ALTER COLUMN "status" TYPE TEXT USING "status"::text,
  ALTER COLUMN "status" SET DEFAULT 'ACTIVE';

ALTER TABLE "Quiz"
  ALTER COLUMN "type" TYPE TEXT USING "type"::text;

ALTER TABLE "Badge"
  ALTER COLUMN "type" TYPE TEXT USING "type"::text;

ALTER TABLE "UserSettings"
  ALTER COLUMN "theme" DROP DEFAULT,
  ALTER COLUMN "theme" TYPE TEXT USING "theme"::text,
  ALTER COLUMN "theme" SET DEFAULT 'light';

DROP TYPE "UserRole";
DROP TYPE "TopicContentType";
DROP TYPE "EnrollmentStatus";
DROP TYPE "QuizType";
DROP TYPE "BadgeType";
DROP TYPE "ThemePreference";

COMMIT;
