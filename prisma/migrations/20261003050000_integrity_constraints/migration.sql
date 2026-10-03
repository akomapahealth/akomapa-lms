-- Integrity constraints (#51).
--
-- Invariants the schema's types and foreign keys cannot state: numeric ranges,
-- identifiers that never change, and one Pre-Test and one Post-Test per Course.
-- Generated from lib/db/integrity.ts, which the preflight and the tests read
-- too; tests/unit/db/integrity.test.ts fails if this file and that list
-- disagree. Prisma does not model CHECK constraints, triggers, or partial
-- indexes, so the drift check does not see them.
--
-- Verify, then contract, in one transaction. Nothing is repaired: a row outside
-- a range or a Course with two Pre-Tests needs a person to decide which value
-- or which Quiz is right (docs/runbooks/database-integrity.md). The migration
-- reports every violation by rule and count and changes nothing.
-- `npm run db:integrity:preflight` reports the same before deploying.
--
-- Rollback: docs/runbooks/database-integrity.md#rollback.

-- 1. Verify ------------------------------------------------------------------

DO $$
DECLARE
  report text := '';
  found record;
BEGIN
  FOR found IN
    SELECT 'Course_price_non_negative' AS rule, count(*) AS n FROM "Course" WHERE NOT ("price" IS NULL OR "price" >= 0)
    UNION ALL
    SELECT 'Quiz_passingScore_percentage' AS rule, count(*) AS n FROM "Quiz" WHERE NOT ("passingScore" >= 0 AND "passingScore" <= 100)
    UNION ALL
    SELECT 'Quiz_timeLimitMinutes_positive' AS rule, count(*) AS n FROM "Quiz" WHERE NOT ("timeLimitMinutes" IS NULL OR "timeLimitMinutes" > 0)
    UNION ALL
    SELECT 'Question_points_non_negative' AS rule, count(*) AS n FROM "Question" WHERE NOT ("points" >= 0)
    UNION ALL
    SELECT 'QuizAttempt_score_within_total' AS rule, count(*) AS n FROM "QuizAttempt" WHERE NOT (("totalPoints" IS NULL OR "totalPoints" >= 0) AND ("score" IS NULL OR ("score" >= 0 AND ("totalPoints" IS NULL OR "score" <= "totalPoints"))))
    UNION ALL
    SELECT 'LearningStreak_counts_consistent' AS rule, count(*) AS n FROM "LearningStreak" WHERE NOT ("currentStreak" >= 0 AND "longestStreak" >= "currentStreak")
    UNION ALL
    SELECT 'Module_position_non_negative' AS rule, count(*) AS n FROM "Module" WHERE NOT ("position" >= 0)
    UNION ALL
    SELECT 'Chapter_position_non_negative' AS rule, count(*) AS n FROM "Chapter" WHERE NOT ("position" >= 0)
    UNION ALL
    SELECT 'Question_position_non_negative' AS rule, count(*) AS n FROM "Question" WHERE NOT ("position" >= 0)
    UNION ALL
    SELECT 'QuestionOption_position_non_negative' AS rule, count(*) AS n FROM "QuestionOption" WHERE NOT ("position" >= 0)
    UNION ALL
    SELECT 'Quiz_courseId_growth_type_key', count(*) FROM (
      SELECT "courseId", "type" FROM "Quiz"
       WHERE "type" IN ('PRE_TEST', 'POST_TEST') AND "courseId" IS NOT NULL
       GROUP BY 1, 2 HAVING count(*) > 1
    ) AS duplicated
  LOOP
    IF found.n > 0 THEN
      report := report || format(E'\n  %s: %s rows', found.rule, found.n);
    END IF;
  END LOOP;

  IF report <> '' THEN
    RAISE EXCEPTION 'integrity_constraints: existing rows violate these rules; nothing was changed.%', report
      USING HINT = 'Run npm run db:integrity:preflight for detail, resolve each row explicitly, then deploy again.';
  END IF;
END
$$;

-- 2. Ranges --------------------------------------------------------------------

-- A negative price would credit the learner at checkout.
ALTER TABLE "Course" ADD CONSTRAINT "Course_price_non_negative" CHECK ("price" IS NULL OR "price" >= 0);

-- The passing score is a percentage; outside 0-100 a Quiz cannot be passed, or cannot be failed.
ALTER TABLE "Quiz" ADD CONSTRAINT "Quiz_passingScore_percentage" CHECK ("passingScore" >= 0 AND "passingScore" <= 100);

-- A zero or negative time limit expires every attempt at once; no limit is NULL.
ALTER TABLE "Quiz" ADD CONSTRAINT "Quiz_timeLimitMinutes_positive" CHECK ("timeLimitMinutes" IS NULL OR "timeLimitMinutes" > 0);

-- Negative points would subtract from a correct answer's total.
ALTER TABLE "Question" ADD CONSTRAINT "Question_points_non_negative" CHECK ("points" >= 0);

-- A score above the total, or below zero, is a grading fault that would flow into Certificates.
ALTER TABLE "QuizAttempt" ADD CONSTRAINT "QuizAttempt_score_within_total" CHECK (("totalPoints" IS NULL OR "totalPoints" >= 0) AND ("score" IS NULL OR ("score" >= 0 AND ("totalPoints" IS NULL OR "score" <= "totalPoints"))));

-- The longest streak can never be shorter than the current one.
ALTER TABLE "LearningStreak" ADD CONSTRAINT "LearningStreak_counts_consistent" CHECK ("currentStreak" >= 0 AND "longestStreak" >= "currentStreak");

-- Positions are ordinals; reorders park rows above the maximum, never below zero.
ALTER TABLE "Module" ADD CONSTRAINT "Module_position_non_negative" CHECK ("position" >= 0);

-- As above, for Topics.
ALTER TABLE "Chapter" ADD CONSTRAINT "Chapter_position_non_negative" CHECK ("position" >= 0);

-- As above, for Questions.
ALTER TABLE "Question" ADD CONSTRAINT "Question_position_non_negative" CHECK ("position" >= 0);

-- As above, for answer options.
ALTER TABLE "QuestionOption" ADD CONSTRAINT "QuestionOption_position_non_negative" CHECK ("position" >= 0);

-- 3. Immutable identifiers -----------------------------------------------------

CREATE FUNCTION akomapa_refuse_identifier_change() RETURNS trigger AS $$
DECLARE
  col text;
BEGIN
  FOREACH col IN ARRAY TG_ARGV LOOP
    IF to_jsonb(NEW) -> col IS DISTINCT FROM to_jsonb(OLD) -> col THEN
      RAISE EXCEPTION 'immutable_identifier: %.% cannot change', TG_TABLE_NAME, col
        USING ERRCODE = 'check_violation';
    END IF;
  END LOOP;
  RETURN NEW;
END
$$ LANGUAGE plpgsql;

-- A Certificate number is permanently verifiable at /verify; re-pointing it would forge a credential.
CREATE TRIGGER "Certificate_identifiers_immutable" BEFORE UPDATE ON "Certificate"
  FOR EACH ROW EXECUTE FUNCTION akomapa_refuse_identifier_change('certificateNumber', 'userId', 'courseId');

-- Payment evidence must keep describing the payment that happened.
CREATE TRIGGER "Purchase_identifiers_immutable" BEFORE UPDATE ON "Purchase"
  FOR EACH ROW EXECUTE FUNCTION akomapa_refuse_identifier_change('userId', 'courseId');

-- An entitlement moves between states, never between learners or Courses.
CREATE TRIGGER "Enrollment_identifiers_immutable" BEFORE UPDATE ON "Enrollment"
  FOR EACH ROW EXECUTE FUNCTION akomapa_refuse_identifier_change('userId', 'courseId');

-- A grade belongs to one learner's attempt at one Quiz.
CREATE TRIGGER "QuizAttempt_identifiers_immutable" BEFORE UPDATE ON "QuizAttempt"
  FOR EACH ROW EXECUTE FUNCTION akomapa_refuse_identifier_change('userId', 'quizId');

-- Progress belongs to one learner on one Topic.
CREATE TRIGGER "UserProgress_identifiers_immutable" BEFORE UPDATE ON "UserProgress"
  FOR EACH ROW EXECUTE FUNCTION akomapa_refuse_identifier_change('userId', 'chapterId');

-- 4. One Pre-Test and one Post-Test per Course ---------------------------------

CREATE UNIQUE INDEX "Quiz_courseId_growth_type_key" ON "Quiz" ("courseId", "type")
  WHERE "type" IN ('PRE_TEST', 'POST_TEST');
