-- Indexes from query evidence (#51).
--
-- Each index serves a query the application actually runs; the mapping from
-- query to index is in docs/runbooks/database-integrity.md#indexes, and
-- tests/integration/query-plans.test.ts asserts PostgreSQL can answer each one
-- from its index. Creates come before drops, so no query is ever left without
-- an index between the two.
--
-- Not CONCURRENTLY: Prisma applies a migration inside a transaction, where
-- CREATE INDEX CONCURRENTLY is not allowed. At current production volumes
-- (2026-10: one User, no Courses) the lock is momentary. A future index on a
-- large table should be created CONCURRENTLY by hand before its migration,
-- which then finds it present.
--
-- Rollback: drop the new indexes and re-create the five dropped ones; nothing
-- else changes (docs/runbooks/database-integrity.md#rollback).

-- New indexes -----------------------------------------------------------------
CREATE INDEX "User_role_createdAt_idx" ON "User"("role", "createdAt");
CREATE INDEX "Course_userId_createdAt_idx" ON "Course"("userId", "createdAt");
CREATE INDEX "UserProgress_isCompleted_updatedAt_idx" ON "UserProgress"("isCompleted", "updatedAt");
CREATE INDEX "Enrollment_enrolledAt_idx" ON "Enrollment"("enrolledAt");
CREATE INDEX "QuizAttempt_userId_quizId_idx" ON "QuizAttempt"("userId", "quizId");
CREATE INDEX "QuizAttempt_completedAt_idx" ON "QuizAttempt"("completedAt");
CREATE INDEX "ForumPost_userId_createdAt_idx" ON "ForumPost"("userId", "createdAt");
CREATE INDEX "ForumPost_isPinned_createdAt_idx" ON "ForumPost"("isPinned", "createdAt");
CREATE INDEX "ForumPost_createdAt_idx" ON "ForumPost"("createdAt");
CREATE INDEX "JournalEntry_userId_updatedAt_idx" ON "JournalEntry"("userId", "updatedAt");

-- Replaced by a wider index, or covered by a unique index's leading column ----
DROP INDEX "QuizAttempt_userId_idx";
DROP INDEX "ForumPost_userId_idx";
DROP INDEX "UserBadge_userId_idx";
DROP INDEX "JournalEntry_userId_idx";
DROP INDEX "Certificate_userId_idx";
