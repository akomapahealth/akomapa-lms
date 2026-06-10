-- Phase 1: Modules, Quiz System, Enrollment, Roles
-- This migration adds the Module layer, quiz system, enrollment, and role fields.
-- It requires a DATA MIGRATION script to be run after: scripts/migrate-chapters-to-modules.ts

-- =========================================
-- 1. Add role and faculty fields to User
-- =========================================
ALTER TABLE "User" ADD COLUMN "role" TEXT NOT NULL DEFAULT 'STUDENT';
ALTER TABLE "User" ADD COLUMN "bio" TEXT;
ALTER TABLE "User" ADD COLUMN "title" TEXT;
ALTER TABLE "User" ADD COLUMN "specialization" TEXT;

-- =========================================
-- 2. Create Module table
-- =========================================
CREATE TABLE "Module" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "imageUrl" TEXT,
    "position" INTEGER NOT NULL,
    "isPublished" BOOLEAN NOT NULL DEFAULT false,
    "courseId" TEXT NOT NULL,
    "facultyId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Module_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Module_courseId_idx" ON "Module"("courseId");

ALTER TABLE "Module" ADD CONSTRAINT "Module_courseId_fkey"
    FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Module" ADD CONSTRAINT "Module_facultyId_fkey"
    FOREIGN KEY ("facultyId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- =========================================
-- 3. Add moduleId to Chapter table (nullable first)
-- =========================================
ALTER TABLE "Chapter" ADD COLUMN "moduleId" TEXT;
ALTER TABLE "Chapter" ADD COLUMN "textContent" TEXT;
ALTER TABLE "Chapter" ADD COLUMN "contentType" TEXT NOT NULL DEFAULT 'VIDEO';

CREATE INDEX "Chapter_moduleId_idx" ON "Chapter"("moduleId");

-- NOTE: After this migration, run: npx tsx scripts/migrate-chapters-to-modules.ts
-- That script will:
--   1. Create default modules for each course
--   2. Set moduleId on all existing chapters
-- Then run the next migration to make moduleId required and drop courseId.

-- =========================================
-- 4. Create Enrollment table
-- =========================================
CREATE TABLE "Enrollment" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "enrolledAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Enrollment_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Enrollment_userId_courseId_key" ON "Enrollment"("userId", "courseId");
CREATE INDEX "Enrollment_courseId_idx" ON "Enrollment"("courseId");

ALTER TABLE "Enrollment" ADD CONSTRAINT "Enrollment_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Enrollment" ADD CONSTRAINT "Enrollment_courseId_fkey"
    FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- =========================================
-- 5. Create Quiz System tables
-- =========================================
CREATE TABLE "Quiz" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "timeLimitMinutes" INTEGER,
    "passingScore" DOUBLE PRECISION NOT NULL DEFAULT 70,
    "isPublished" BOOLEAN NOT NULL DEFAULT false,
    "courseId" TEXT,
    "moduleId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Quiz_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Quiz_courseId_idx" ON "Quiz"("courseId");
CREATE INDEX "Quiz_moduleId_idx" ON "Quiz"("moduleId");

ALTER TABLE "Quiz" ADD CONSTRAINT "Quiz_courseId_fkey"
    FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Quiz" ADD CONSTRAINT "Quiz_moduleId_fkey"
    FOREIGN KEY ("moduleId") REFERENCES "Module"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "Question" (
    "id" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "points" INTEGER NOT NULL DEFAULT 1,
    "quizId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Question_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Question_quizId_idx" ON "Question"("quizId");

ALTER TABLE "Question" ADD CONSTRAINT "Question_quizId_fkey"
    FOREIGN KEY ("quizId") REFERENCES "Quiz"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "QuestionOption" (
    "id" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "isCorrect" BOOLEAN NOT NULL DEFAULT false,
    "position" INTEGER NOT NULL,
    "questionId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "QuestionOption_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "QuestionOption_questionId_idx" ON "QuestionOption"("questionId");

ALTER TABLE "QuestionOption" ADD CONSTRAINT "QuestionOption_questionId_fkey"
    FOREIGN KEY ("questionId") REFERENCES "Question"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "QuizAttempt" (
    "id" TEXT NOT NULL,
    "score" DOUBLE PRECISION,
    "totalPoints" INTEGER,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "userId" TEXT NOT NULL,
    "quizId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "QuizAttempt_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "QuizAttempt_userId_idx" ON "QuizAttempt"("userId");
CREATE INDEX "QuizAttempt_quizId_idx" ON "QuizAttempt"("quizId");

ALTER TABLE "QuizAttempt" ADD CONSTRAINT "QuizAttempt_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "QuizAttempt" ADD CONSTRAINT "QuizAttempt_quizId_fkey"
    FOREIGN KEY ("quizId") REFERENCES "Quiz"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "QuizAnswer" (
    "id" TEXT NOT NULL,
    "attemptId" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "selectedOptionId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "QuizAnswer_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "QuizAnswer_attemptId_idx" ON "QuizAnswer"("attemptId");
CREATE INDEX "QuizAnswer_questionId_idx" ON "QuizAnswer"("questionId");

ALTER TABLE "QuizAnswer" ADD CONSTRAINT "QuizAnswer_attemptId_fkey"
    FOREIGN KEY ("attemptId") REFERENCES "QuizAttempt"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "QuizAnswer" ADD CONSTRAINT "QuizAnswer_questionId_fkey"
    FOREIGN KEY ("questionId") REFERENCES "Question"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "QuizAnswer" ADD CONSTRAINT "QuizAnswer_selectedOptionId_fkey"
    FOREIGN KEY ("selectedOptionId") REFERENCES "QuestionOption"("id") ON DELETE SET NULL ON UPDATE CASCADE;
