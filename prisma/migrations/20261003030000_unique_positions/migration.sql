-- Unique positions per parent (#51).
--
-- Module (per Course), Topic (per Module; table "Chapter"), Question (per Quiz),
-- and QuestionOption (per Question) may no longer share a position with a
-- sibling. Two rows at one position made the order non-deterministic: the
-- sidebar, the quiz, and the answer options could appear in a different order on
-- each read, and "last position + 1" on create raced into exactly that state.
--
-- Expand, backfill, verify, contract:
--   1. backfill: renumber only the parents that already hold duplicates, keeping
--      their relative order (position, then createdAt, then id) and starting from
--      that parent's lowest position. Parents without duplicates are untouched,
--      so ordinary gaps (1, 2, 5) are left as they are. This is a deterministic,
--      order-preserving repair, not a coercion: no row's relative place changes,
--      and `npm run db:integrity:preflight` reports every affected parent first.
--   2. verify + contract: the unique indexes. They cannot be created over
--      duplicates, so creating them is the verification.
--   3. drop the single-column indexes each unique index now covers as a prefix.
--
-- The application keeps the invariant: reorders move rows through temporary
-- positions in one transaction (lib/courses/ordering.ts), and creates retry on a
-- collision.
--
-- Rollback: DROP the four unique indexes and re-create the four single-column
-- indexes (docs/runbooks/database-integrity.md#rollback). The renumbering is not
-- reverted: the previous order was ambiguous, so there is nothing to restore.

-- 1. Backfill ----------------------------------------------------------------

-- Module: parents with duplicate positions only.
WITH duplicated AS (
  SELECT "courseId" FROM "Module" GROUP BY "courseId", "position" HAVING count(*) > 1
), ranked AS (
  SELECT id,
         MIN("position") OVER (PARTITION BY "courseId")
           + ROW_NUMBER() OVER (PARTITION BY "courseId" ORDER BY "position", "createdAt", id) - 1 AS renumbered
    FROM "Module"
   WHERE "courseId" IN (SELECT "courseId" FROM duplicated)
)
UPDATE "Module" AS row SET "position" = ranked.renumbered
  FROM ranked
 WHERE row.id = ranked.id AND row."position" <> ranked.renumbered;

-- Chapter: parents with duplicate positions only.
WITH duplicated AS (
  SELECT "moduleId" FROM "Chapter" GROUP BY "moduleId", "position" HAVING count(*) > 1
), ranked AS (
  SELECT id,
         MIN("position") OVER (PARTITION BY "moduleId")
           + ROW_NUMBER() OVER (PARTITION BY "moduleId" ORDER BY "position", "createdAt", id) - 1 AS renumbered
    FROM "Chapter"
   WHERE "moduleId" IN (SELECT "moduleId" FROM duplicated)
)
UPDATE "Chapter" AS row SET "position" = ranked.renumbered
  FROM ranked
 WHERE row.id = ranked.id AND row."position" <> ranked.renumbered;

-- Question: parents with duplicate positions only.
WITH duplicated AS (
  SELECT "quizId" FROM "Question" GROUP BY "quizId", "position" HAVING count(*) > 1
), ranked AS (
  SELECT id,
         MIN("position") OVER (PARTITION BY "quizId")
           + ROW_NUMBER() OVER (PARTITION BY "quizId" ORDER BY "position", "createdAt", id) - 1 AS renumbered
    FROM "Question"
   WHERE "quizId" IN (SELECT "quizId" FROM duplicated)
)
UPDATE "Question" AS row SET "position" = ranked.renumbered
  FROM ranked
 WHERE row.id = ranked.id AND row."position" <> ranked.renumbered;

-- QuestionOption: parents with duplicate positions only.
WITH duplicated AS (
  SELECT "questionId" FROM "QuestionOption" GROUP BY "questionId", "position" HAVING count(*) > 1
), ranked AS (
  SELECT id,
         MIN("position") OVER (PARTITION BY "questionId")
           + ROW_NUMBER() OVER (PARTITION BY "questionId" ORDER BY "position", "createdAt", id) - 1 AS renumbered
    FROM "QuestionOption"
   WHERE "questionId" IN (SELECT "questionId" FROM duplicated)
)
UPDATE "QuestionOption" AS row SET "position" = ranked.renumbered
  FROM ranked
 WHERE row.id = ranked.id AND row."position" <> ranked.renumbered;

-- 2. Verify and contract -----------------------------------------------------

CREATE UNIQUE INDEX "Module_courseId_position_key" ON "Module"("courseId", "position");
CREATE UNIQUE INDEX "Chapter_moduleId_position_key" ON "Chapter"("moduleId", "position");
CREATE UNIQUE INDEX "Question_quizId_position_key" ON "Question"("quizId", "position");
CREATE UNIQUE INDEX "QuestionOption_questionId_position_key" ON "QuestionOption"("questionId", "position");

-- 3. Indexes the unique indexes now cover -------------------------------------

DROP INDEX "Module_courseId_idx";
DROP INDEX "Chapter_moduleId_idx";
DROP INDEX "Question_quizId_idx";
DROP INDEX "QuestionOption_questionId_idx";
