import type { Badge } from "@prisma/client";
import { z } from "zod";

import { db } from "@/lib/db";

/**
 * Any client that can run the badge queries: the shared one, or a transaction.
 * The completion command passes its transaction (#49, ADR 0004), so badges are
 * judged on the progress it is about to commit and awarded in the same commit.
 */
type BadgeClient = Pick<
  typeof db,
  | "badge"
  | "userBadge"
  | "userProgress"
  | "module"
  | "enrollment"
  | "course"
  | "quiz"
  | "quizAttempt"
  | "forumPost"
  | "postLike"
  | "forumComment"
>;
import { logWarn } from "@/lib/logger";

export type BadgeEvent =
  | { type: "topic_completed"; topicId: string }
  | { type: "module_completed"; moduleId: string }
  | { type: "course_completed"; courseId: string }
  | { type: "quiz_completed"; quizId: string; score: number; preTestScore?: number }
  | { type: "post_created"; postId: string }
  | { type: "comment_created"; commentId: string }
  | { type: "streak_updated"; currentStreak: number };

const count = z.number().int().positive().optional();

/**
 * The closed set of badge rules, validated rather than cast (#50).
 *
 * `Badge.criteria` is JSON, so the database cannot constrain it. It used to be
 * read with `as unknown as BadgeCriteria` and switched on a free-form `type`, so
 * a typo in a seeded rule silently made a badge unearnable, and a malformed
 * count was compared as whatever it happened to be. Each rule is now a member of
 * a discriminated union; anything else is skipped and logged, never awarded.
 */
export const badgeCriteriaSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("topics_completed"), count }).strict(),
  z.object({ type: z.literal("modules_completed"), count }).strict(),
  z.object({ type: z.literal("courses_completed"), count }).strict(),
  z.object({ type: z.literal("category_completed"), category: z.string().min(1) }).strict(),
  z.object({ type: z.literal("quiz_score"), score: z.number().min(0).max(100).optional() }).strict(),
  z
    .object({ type: z.literal("score_improvement"), minImprovement: z.number().min(0).max(100).optional() })
    .strict(),
  z.object({ type: z.literal("all_quizzes_passed"), scope: z.literal("course").optional() }).strict(),
  z.object({ type: z.literal("streak_days"), count }).strict(),
  z.object({ type: z.literal("posts_created"), count }).strict(),
  z.object({ type: z.literal("post_likes_received"), count }).strict(),
  z.object({ type: z.literal("comments_created"), count }).strict(),
]);

export type BadgeCriteria = z.infer<typeof badgeCriteriaSchema>;

/**
 * Evaluates all badge criteria for a user given an event.
 * Returns the list of newly awarded badges (for toast notifications).
 */
export async function evaluateBadges(
  userId: string,
  event: BadgeEvent,
  client: BadgeClient = db
): Promise<Badge[]> {
  const [allBadges, earnedBadgeIds] = await Promise.all([
    client.badge.findMany(),
    client.userBadge
      .findMany({ where: { userId }, select: { badgeId: true } })
      .then((ub) => new Set(ub.map((b) => b.badgeId))),
  ]);

  const unearnedBadges = allBadges.filter((b) => !earnedBadgeIds.has(b.id));
  if (unearnedBadges.length === 0) return [];

  const newlyEarned: Badge[] = [];

  for (const badge of unearnedBadges) {
    const parsed = badgeCriteriaSchema.safeParse(badge.criteria);
    if (!parsed.success) {
      // The badge id is a safe identifier; the criteria JSON is not echoed.
      logWarn("BADGE_CRITERIA_INVALID", { badgeId: badge.id });
      continue;
    }
    const met = await checkCriteria(userId, parsed.data, event, client);
    if (met) {
      newlyEarned.push(badge);
    }
  }

  if (newlyEarned.length > 0) {
    await client.userBadge.createMany({
      data: newlyEarned.map((badge) => ({
        userId,
        badgeId: badge.id,
      })),
      skipDuplicates: true,
    });
  }

  return newlyEarned;
}

async function checkCriteria(
  userId: string,
  criteria: BadgeCriteria,
  event: BadgeEvent,
  client: BadgeClient
): Promise<boolean> {
  switch (criteria.type) {
    case "topics_completed": {
      if (event.type !== "topic_completed") return false;
      const count = await client.userProgress.count({
        where: { userId, isCompleted: true },
      });
      return count >= (criteria.count ?? 1);
    }

    case "modules_completed": {
      if (event.type !== "module_completed") return false;
      const completedModules = await getCompletedModuleCount(userId, client);
      return completedModules >= (criteria.count ?? 1);
    }

    case "courses_completed": {
      if (event.type !== "course_completed") return false;
      const completedCourses = await getCompletedCourseCount(userId, client);
      return completedCourses >= (criteria.count ?? 1);
    }

    case "category_completed": {
      if (event.type !== "module_completed" && event.type !== "course_completed") return false;
      return checkCategoryCompleted(userId, criteria.category, client);
    }

    case "quiz_score": {
      if (event.type !== "quiz_completed") return false;
      return event.score >= (criteria.score ?? 100);
    }

    case "score_improvement": {
      if (event.type !== "quiz_completed") return false;
      if (event.preTestScore === undefined) return false;
      const improvement = event.score - event.preTestScore;
      return improvement >= (criteria.minImprovement ?? 20);
    }

    case "all_quizzes_passed": {
      if (event.type !== "quiz_completed") return false;
      return checkAllQuizzesPassed(userId, event.quizId, client);
    }

    case "streak_days": {
      if (event.type !== "streak_updated") return false;
      return event.currentStreak >= (criteria.count ?? 7);
    }

    case "posts_created": {
      if (event.type !== "post_created") return false;
      const postCount = await client.forumPost.count({ where: { userId } });
      return postCount >= (criteria.count ?? 5);
    }

    case "post_likes_received": {
      if (event.type !== "post_created" && event.type !== "comment_created") return false;
      const likeCount = await client.postLike.count({
        where: { post: { userId } },
      });
      return likeCount >= (criteria.count ?? 50);
    }

    case "comments_created": {
      if (event.type !== "comment_created") return false;
      const commentCount = await client.forumComment.count({ where: { userId } });
      return commentCount >= (criteria.count ?? 10);
    }

    default: {
      // Exhaustive: a rule added to the schema without a case fails to compile.
      const unhandled: never = criteria;
      return unhandled;
    }
  }
}

async function getCompletedModuleCount(userId: string, client: BadgeClient): Promise<number> {
  const modules = await client.module.findMany({
    where: {
      isPublished: true,
      course: { purchases: { some: { userId } } },
    },
    include: {
      topics: {
        where: { isPublished: true },
        select: { id: true },
      },
    },
  });

  let completedCount = 0;
  for (const mod of modules) {
    if (mod.topics.length === 0) continue;
    const completedTopics = await client.userProgress.count({
      where: {
        userId,
        isCompleted: true,
        topicId: { in: mod.topics.map((t) => t.id) },
      },
    });
    if (completedTopics === mod.topics.length) {
      completedCount++;
    }
  }
  return completedCount;
}

/**
 * How many Courses this learner has completed, for a badge criterion.
 *
 * An aggregate statistic, not an access decision, so it reads the table directly
 * rather than going through `@/lib/entitlement` (exempt in .eslintrc.json). #83
 * owns making badge evaluation idempotent and event-driven.
 */
async function getCompletedCourseCount(userId: string, client: BadgeClient): Promise<number> {
  const enrollments = await client.enrollment.count({
    where: { userId, status: "COMPLETED" },
  });
  return enrollments;
}

async function checkCategoryCompleted(
  userId: string,
  categoryName: string,
  client: BadgeClient
): Promise<boolean> {
  const courses = await client.course.findMany({
    where: {
      category: { name: categoryName },
      purchases: { some: { userId } },
    },
    include: {
      modules: {
        where: { isPublished: true },
        include: {
          topics: {
            where: { isPublished: true },
            select: { id: true },
          },
        },
      },
    },
  });

  if (courses.length === 0) return false;

  for (const course of courses) {
    for (const mod of course.modules) {
      if (mod.topics.length === 0) continue;
      const completed = await client.userProgress.count({
        where: {
          userId,
          isCompleted: true,
          topicId: { in: mod.topics.map((t) => t.id) },
        },
      });
      if (completed < mod.topics.length) return false;
    }
  }
  return true;
}

async function checkAllQuizzesPassed(
  userId: string,
  currentQuizId: string,
  client: BadgeClient
): Promise<boolean> {
  const quiz = await client.quiz.findUnique({
    where: { id: currentQuizId },
    select: { courseId: true },
  });
  if (!quiz?.courseId) return false;

  const courseQuizzes = await client.quiz.findMany({
    where: { courseId: quiz.courseId, isPublished: true },
    select: { id: true, passingScore: true },
  });

  for (const q of courseQuizzes) {
    const bestAttempt = await client.quizAttempt.findFirst({
      where: { userId, quizId: q.id, completedAt: { not: null } },
      orderBy: { score: "desc" },
      select: { score: true },
    });
    if (!bestAttempt || (bestAttempt.score ?? 0) < q.passingScore) {
      return false;
    }
  }
  return true;
}
