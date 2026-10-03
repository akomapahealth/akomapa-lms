-- Retention-safe deletes (#51).
--
-- Every relation in schema.prisma now states its delete behaviour, and these
-- eight change. Deleting authored content -- a Course, a Topic, a Quiz, a
-- Question, a Case Study -- used to cascade into records that belong to learners
-- or to the Foundation's books:
--
--   Purchase          payment evidence; retained 7 years (policy 02)
--   Enrollment        the entitlement and its history (ADR 0002)
--   UserProgress      learning record; feeds completion and Certificates
--   QuizAttempt       learning record and grade
--   QuizAnswer        the answers a grade was computed from (question and option)
--   CaseStudyAttempt  learning record
--
-- They are RESTRICT now: authored content that learners have used cannot be
-- deleted, only unpublished. The routes check first and answer 409 with a
-- reason; this is the backstop for a race between that check and the delete.
-- Module.facultyId is RESTRICT too: User rows are anonymised, never deleted
-- (policy 02), so nothing should ever try.
--
-- Constraint changes only: no row is read, written, or removed, and every
-- existing row already satisfies the new rules. The decision table lives in
-- docs/runbooks/database-integrity.md.
--
-- Rollback: re-run the inverse (ON DELETE CASCADE / SET NULL) statements in
-- docs/runbooks/database-integrity.md#rollback.


-- DropForeignKey
ALTER TABLE "Module" DROP CONSTRAINT "Module_facultyId_fkey";

-- DropForeignKey
ALTER TABLE "UserProgress" DROP CONSTRAINT "UserProgress_chapterId_fkey";

-- DropForeignKey
ALTER TABLE "Purchase" DROP CONSTRAINT "Purchase_courseId_fkey";

-- DropForeignKey
ALTER TABLE "Enrollment" DROP CONSTRAINT "Enrollment_courseId_fkey";

-- DropForeignKey
ALTER TABLE "QuizAttempt" DROP CONSTRAINT "QuizAttempt_quizId_fkey";

-- DropForeignKey
ALTER TABLE "QuizAnswer" DROP CONSTRAINT "QuizAnswer_questionId_fkey";

-- DropForeignKey
ALTER TABLE "QuizAnswer" DROP CONSTRAINT "QuizAnswer_selectedOptionId_fkey";

-- DropForeignKey
ALTER TABLE "CaseStudyAttempt" DROP CONSTRAINT "CaseStudyAttempt_caseStudyId_fkey";

-- AddForeignKey
ALTER TABLE "Module" ADD CONSTRAINT "Module_facultyId_fkey" FOREIGN KEY ("facultyId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserProgress" ADD CONSTRAINT "UserProgress_chapterId_fkey" FOREIGN KEY ("chapterId") REFERENCES "Chapter"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Purchase" ADD CONSTRAINT "Purchase_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Enrollment" ADD CONSTRAINT "Enrollment_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuizAttempt" ADD CONSTRAINT "QuizAttempt_quizId_fkey" FOREIGN KEY ("quizId") REFERENCES "Quiz"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuizAnswer" ADD CONSTRAINT "QuizAnswer_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "Question"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuizAnswer" ADD CONSTRAINT "QuizAnswer_selectedOptionId_fkey" FOREIGN KEY ("selectedOptionId") REFERENCES "QuestionOption"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CaseStudyAttempt" ADD CONSTRAINT "CaseStudyAttempt_caseStudyId_fkey" FOREIGN KEY ("caseStudyId") REFERENCES "CaseStudy"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
