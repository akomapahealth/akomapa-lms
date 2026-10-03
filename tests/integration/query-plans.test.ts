import { describe, expect, it } from "vitest";

import { testPool } from "./support/db";
import { read } from "../unit/support/source-scan";

/**
 * Every high-volume query and authorization predicate has an index that can
 * answer it (#51).
 *
 * On a test-sized table PostgreSQL prefers a sequential scan whatever indexes
 * exist, so each query is planned with sequential scans disabled. If an index
 * can serve it, the plan uses that index; if none can, the planner falls back to
 * a sequential scan anyway, at a huge cost, and the assertion fails. So each row
 * proves "this index serves this query", independent of data volume.
 *
 * The same table, with the code that issues each query, is in
 * docs/runbooks/database-integrity.md#indexes, and the last test keeps the two
 * in step.
 */

interface Evidence {
  query: string;
  sql: string;
  index: string;
}

const ID = "'00000000-0000-4000-8000-000000000000'";
const USER = "'user_1'";

const QUERY_EVIDENCE: Evidence[] = [
  // Authorization predicates
  { query: "Course owned by the principal", sql: `SELECT * FROM "Course" WHERE id = ${ID} AND "userId" = ${USER}`, index: "Course_pkey" },
  { query: "Learner's Enrollment for a Course", sql: `SELECT status FROM "Enrollment" WHERE "userId" = ${USER} AND "courseId" = ${ID}`, index: "Enrollment_userId_courseId_key" },
  { query: "Learner's progress on a Topic", sql: `SELECT * FROM "UserProgress" WHERE "userId" = ${USER} AND "chapterId" = ${ID}`, index: "UserProgress_userId_chapterId_key" },
  { query: "Certificate verification by number", sql: `SELECT * FROM "Certificate" WHERE "certificateNumber" = 'GHELP-2026-00001'`, index: "Certificate_certificateNumber_key" },
  { query: "Learner's Certificate for a Course", sql: `SELECT * FROM "Certificate" WHERE "userId" = ${USER} AND "courseId" = ${ID}`, index: "Certificate_userId_courseId_key" },
  // Learner surfaces
  { query: "Learner's enrolled Courses", sql: `SELECT "courseId" FROM "Enrollment" WHERE "userId" = ${USER} AND status IN ('ACTIVE', 'COMPLETED')`, index: "Enrollment_userId_courseId_key" },
  { query: "Learner's completed Topics", sql: `SELECT count(*) FROM "UserProgress" WHERE "userId" = ${USER} AND "isCompleted"`, index: "UserProgress_userId_chapterId_key" },
  { query: "Modules of a Course, in order", sql: `SELECT * FROM "Module" WHERE "courseId" = ${ID} ORDER BY position`, index: "Module_courseId_position_key" },
  { query: "Topics of a Module, in order", sql: `SELECT * FROM "Chapter" WHERE "moduleId" = ${ID} ORDER BY position`, index: "Chapter_moduleId_position_key" },
  { query: "Questions of a Quiz, in order", sql: `SELECT * FROM "Question" WHERE "quizId" = ${ID} ORDER BY position`, index: "Question_quizId_position_key" },
  { query: "Options of a Question, in order", sql: `SELECT * FROM "QuestionOption" WHERE "questionId" = ${ID} ORDER BY position`, index: "QuestionOption_questionId_position_key" },
  { query: "Best completed attempt per learner per Quiz", sql: `SELECT * FROM "QuizAttempt" WHERE "userId" = ${USER} AND "quizId" = ${ID} AND "completedAt" IS NOT NULL ORDER BY score DESC LIMIT 1`, index: "QuizAttempt_userId_quizId_idx" },
  { query: "Learner's badges", sql: `SELECT * FROM "UserBadge" WHERE "userId" = ${USER}`, index: "UserBadge_userId_badgeId_key" },
  { query: "Learner's journal, most recent first", sql: `SELECT * FROM "JournalEntry" WHERE "userId" = ${USER} ORDER BY "updatedAt" DESC`, index: "JournalEntry_userId_updatedAt_idx" },
  // Community
  { query: "Community feed, newest first", sql: `SELECT * FROM "ForumPost" ORDER BY "createdAt" DESC LIMIT 20`, index: "ForumPost_createdAt_idx" },
  { query: "Pinned posts, newest first", sql: `SELECT * FROM "ForumPost" WHERE "isPinned" ORDER BY "createdAt" DESC`, index: "ForumPost_isPinned_createdAt_idx" },
  { query: "A member's posts, newest first", sql: `SELECT * FROM "ForumPost" WHERE "userId" = ${USER} ORDER BY "createdAt" DESC`, index: "ForumPost_userId_createdAt_idx" },
  { query: "Posts in a category", sql: `SELECT count(*) FROM "ForumPost" WHERE "categoryId" = ${ID}`, index: "ForumPost_categoryId_idx" },
  { query: "Comments on a post", sql: `SELECT * FROM "ForumComment" WHERE "postId" = ${ID}`, index: "ForumComment_postId_idx" },
  { query: "Likes on a post", sql: `SELECT count(*) FROM "PostLike" WHERE "postId" = ${ID}`, index: "PostLike_postId_idx" },
  // Authoring and administration
  { query: "An author's Courses, newest first", sql: `SELECT * FROM "Course" WHERE "userId" = ${USER} ORDER BY "createdAt" DESC`, index: "Course_userId_createdAt_idx" },
  { query: "Admin student list, newest first", sql: `SELECT * FROM "User" WHERE role = 'STUDENT' ORDER BY "createdAt" DESC`, index: "User_role_createdAt_idx" },
  { query: "Enrollments of a Course", sql: `SELECT * FROM "Enrollment" WHERE "courseId" = ${ID}`, index: "Enrollment_courseId_idx" },
  { query: "Attempts on a Quiz", sql: `SELECT * FROM "QuizAttempt" WHERE "quizId" = ${ID}`, index: "QuizAttempt_quizId_idx" },
  { query: "Progress on a Topic", sql: `SELECT * FROM "UserProgress" WHERE "chapterId" = ${ID}`, index: "UserProgress_chapterId_idx" },
  // Analytics over date ranges
  { query: "Enrolments in a period", sql: `SELECT count(*) FROM "Enrollment" WHERE "enrolledAt" >= now() - interval '30 days'`, index: "Enrollment_enrolledAt_idx" },
  { query: "Completed attempts in a period", sql: `SELECT count(*) FROM "QuizAttempt" WHERE "completedAt" >= now() - interval '30 days'`, index: "QuizAttempt_completedAt_idx" },
  { query: "Topic completions in a period", sql: `SELECT count(*) FROM "UserProgress" WHERE "isCompleted" AND "updatedAt" >= now() - interval '30 days'`, index: "UserProgress_isCompleted_updatedAt_idx" },
  // Housekeeping
  { query: "Expired rate-limit buckets", sql: `SELECT key FROM "RateLimitBucket" WHERE "expiresAt" < now() LIMIT 500`, index: "RateLimitBucket_expiresAt_idx" },
];

/** Every index name anywhere in a JSON plan. */
function indexesIn(plan: unknown): string[] {
  if (Array.isArray(plan)) return plan.flatMap(indexesIn);
  if (plan === null || typeof plan !== "object") return [];
  const node = plan as Record<string, unknown>;
  const own = typeof node["Index Name"] === "string" ? [node["Index Name"] as string] : [];
  return [...own, ...Object.values(node).flatMap(indexesIn)];
}

async function planIndexes(sql: string): Promise<string[]> {
  const client = await testPool().connect();
  try {
    await client.query("BEGIN");
    await client.query("SET LOCAL enable_seqscan = off");
    const { rows } = await client.query(`EXPLAIN (FORMAT JSON) ${sql}`);
    await client.query("ROLLBACK");
    return indexesIn(rows[0]["QUERY PLAN"]);
  } finally {
    client.release();
  }
}

describe("query plans", () => {
  it.each(QUERY_EVIDENCE.map((e) => [e.query, e] as const))("%s uses its index", async (_q, evidence) => {
    expect(await planIndexes(evidence.sql)).toContain(evidence.index);
  });

  it("would fail without the index -- the check is not vacuous", async () => {
    // Nothing indexes Course.title, so even with sequential scans off there is
    // no index to report.
    expect(await planIndexes(`SELECT * FROM "Course" WHERE title = 'x'`)).toEqual([]);
  });

  it("is the table the runbook documents", () => {
    const runbook = read("docs/runbooks/database-integrity.md");
    for (const { query, index } of QUERY_EVIDENCE) {
      expect(runbook).toContain(`| ${query} | \`${index}\` |`);
    }
  });
});
