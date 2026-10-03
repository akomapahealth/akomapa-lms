-- Closed domain states (#50): six free-text columns become PostgreSQL enums.
--
-- Hand-written. `prisma migrate diff` proposes DROP COLUMN + ADD COLUMN for each
-- of these, which would discard every role, enrollment status, and quiz type.
-- This converts in place instead, mapping each existing value to itself.
--
-- Expand, verify, contract -- in one transaction, so the database ends in the
-- old state or the new one and never between:
--   1. expand:   create the enum types (nothing references them yet);
--   2. verify:   profile every column and abort, with a report, if any row holds
--                a value outside its set. Nothing is coerced: no trimming, no
--                case-folding, no default for the unknown. An unexpected value is
--                a decision for a person (see docs/runbooks/closed-domain-states.md);
--   3. contract: convert each column with ALTER ... TYPE ... USING.
--
-- Deploy window: the previous release's client sends these values as untyped
-- parameters, which PostgreSQL casts to the enum, so it keeps working while
-- this release builds (tests/integration/closed-states.test.ts proves it).
--
-- Preflight before deploying: `npm run db:states:preflight` runs the same
-- profile read-only against any database.
--
-- Rollback (forward-fix preferred; this restores the text columns exactly):
--   see docs/runbooks/closed-domain-states.md#rollback.

-- 1. Expand ------------------------------------------------------------------

CREATE TYPE "UserRole" AS ENUM ('STUDENT', 'FACULTY', 'ADMIN');
CREATE TYPE "TopicContentType" AS ENUM ('VIDEO', 'TEXT', 'INTERACTIVE');
CREATE TYPE "EnrollmentStatus" AS ENUM ('ACTIVE', 'COMPLETED', 'SUSPENDED');
CREATE TYPE "QuizType" AS ENUM ('PRE_TEST', 'POST_TEST', 'MODULE_QUIZ');
CREATE TYPE "BadgeType" AS ENUM ('COMPLETION', 'STREAK', 'COMMUNITY', 'QUIZ_SCORE', 'MILESTONE');
CREATE TYPE "ThemePreference" AS ENUM ('light', 'dark', 'system');

-- 2. Verify ------------------------------------------------------------------

DO $$
DECLARE
  report text := '';
  found record;
BEGIN
  FOR found IN
    SELECT 'User.role' AS col, "role"::text AS value, count(*) AS n
      FROM "User"
     WHERE "role" IS NULL OR "role" NOT IN ('STUDENT', 'FACULTY', 'ADMIN')
     GROUP BY 1, 2
    UNION ALL
    SELECT 'Chapter.contentType', "contentType"::text, count(*)
      FROM "Chapter"
     WHERE "contentType" IS NULL OR "contentType" NOT IN ('VIDEO', 'TEXT', 'INTERACTIVE')
     GROUP BY 1, 2
    UNION ALL
    SELECT 'Enrollment.status', "status"::text, count(*)
      FROM "Enrollment"
     WHERE "status" IS NULL OR "status" NOT IN ('ACTIVE', 'COMPLETED', 'SUSPENDED')
     GROUP BY 1, 2
    UNION ALL
    SELECT 'Quiz.type', "type"::text, count(*)
      FROM "Quiz"
     WHERE "type" IS NULL OR "type" NOT IN ('PRE_TEST', 'POST_TEST', 'MODULE_QUIZ')
     GROUP BY 1, 2
    UNION ALL
    SELECT 'Badge.type', "type"::text, count(*)
      FROM "Badge"
     WHERE "type" IS NULL OR "type" NOT IN ('COMPLETION', 'STREAK', 'COMMUNITY', 'QUIZ_SCORE', 'MILESTONE')
     GROUP BY 1, 2
    UNION ALL
    SELECT 'UserSettings.theme', "theme"::text, count(*)
      FROM "UserSettings"
     WHERE "theme" IS NULL OR "theme" NOT IN ('light', 'dark', 'system')
     GROUP BY 1, 2
  LOOP
    -- Status vocabulary only: these columns hold no personal data.
    report := report || format(E'\n  %s = %L (%s rows)', found.col, found.value, found.n);
  END LOOP;

  IF report <> '' THEN
    RAISE EXCEPTION 'closed_domain_states: unexpected legacy values; nothing was changed.%', report
      USING HINT = 'Resolve each value explicitly (docs/runbooks/closed-domain-states.md), then deploy again.';
  END IF;
END
$$;

-- 3. Contract ----------------------------------------------------------------
-- Defaults are dropped first: a text default cannot be cast with the column.

ALTER TABLE "User"
  ALTER COLUMN "role" DROP DEFAULT,
  ALTER COLUMN "role" TYPE "UserRole" USING "role"::"UserRole",
  ALTER COLUMN "role" SET DEFAULT 'STUDENT';

ALTER TABLE "Chapter"
  ALTER COLUMN "contentType" DROP DEFAULT,
  ALTER COLUMN "contentType" TYPE "TopicContentType" USING "contentType"::"TopicContentType",
  ALTER COLUMN "contentType" SET DEFAULT 'VIDEO';

ALTER TABLE "Enrollment"
  ALTER COLUMN "status" DROP DEFAULT,
  ALTER COLUMN "status" TYPE "EnrollmentStatus" USING "status"::"EnrollmentStatus",
  ALTER COLUMN "status" SET DEFAULT 'ACTIVE';

ALTER TABLE "Quiz"
  ALTER COLUMN "type" TYPE "QuizType" USING "type"::"QuizType";

ALTER TABLE "Badge"
  ALTER COLUMN "type" TYPE "BadgeType" USING "type"::"BadgeType";

ALTER TABLE "UserSettings"
  ALTER COLUMN "theme" DROP DEFAULT,
  ALTER COLUMN "theme" TYPE "ThemePreference" USING "theme"::"ThemePreference",
  ALTER COLUMN "theme" SET DEFAULT 'light';
