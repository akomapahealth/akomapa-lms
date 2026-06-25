import { db } from "@/lib/db";
import type { Badge } from "@prisma/client";

export type BadgeEvent =
  | { type: "topic_completed"; topicId: string }
  | { type: "module_completed"; moduleId: string }
  | { type: "course_completed"; courseId: string }
  | { type: "quiz_completed"; quizId: string; score: number; preTestScore?: number }
  | { type: "post_created"; postId: string }
  | { type: "comment_created"; commentId: string }
  | { type: "streak_updated"; currentStreak: number };

interface BadgeCriteria {
  type: string;
  count?: number;
  score?: number;
  minImprovement?: number;
  category?: string;
  scope?: string;
}

/**
 * Evaluates all badge criteria for a user given an event.
 * Returns the list of newly awarded badges (for toast notifications).
 */
export async function evaluateBadges(
  userId: string,
  event: BadgeEvent
): Promise<Badge[]> {
  const [allBadges, earnedBadgeIds] = await Promise.all([
    db.badge.findMany(),
    db.userBadge
      .findMany({ where: { userId }, select: { badgeId: true } })
      .then((ub) => new Set(ub.map((b) => b.badgeId))),
  ]);

  const unearnedBadges = allBadges.filter((b) => !earnedBadgeIds.has(b.id));
  if (unearnedBadges.length === 0) return [];

  const newlyEarned: Badge[] = [];

  for (const badge of unearnedBadges) {
    const criteria = badge.criteria as unknown as BadgeCriteria;
    const met = await checkCriteria(userId, criteria, event);
    if (met) {
      newlyEarned.push(badge);
    }
  }

  if (newlyEarned.length > 0) {
    await db.userBadge.createMany({
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
  event: BadgeEvent
): Promise<boolean> {
  switch (criteria.type) {
    case "topics_completed": {
      if (event.type !== "topic_completed") return false;
      const count = await db.userProgress.count({
        where: { userId, isCompleted: true },
      });
      return count >= (criteria.count ?? 1);
    }

    case "modules_completed": {
      if (event.type !== "module_completed") return false;
      const completedModules = await getCompletedModuleCount(userId);
      return completedModules >= (criteria.count ?? 1);
    }

    case "courses_completed": {
      if (event.type !== "course_completed") return false;
      const completedCourses = await getCompletedCourseCount(userId);
      return completedCourses >= (criteria.count ?? 1);
    }

    case "category_completed": {
      if (event.type !== "module_completed" && event.type !== "course_completed") return false;
      return checkCategoryCompleted(userId, criteria.category ?? "");
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
      return checkAllQuizzesPassed(userId, event.quizId);
    }

    case "streak_days": {
      if (event.type !== "streak_updated") return false;
      return event.currentStreak >= (criteria.count ?? 7);
    }

    case "posts_created": {
      if (event.type !== "post_created") return false;
      const postCount = await db.forumPost.count({ where: { userId } });
      return postCount >= (criteria.count ?? 5);
    }

    case "post_likes_received": {
      if (event.type !== "post_created" && event.type !== "comment_created") return false;
      const likeCount = await db.postLike.count({
        where: { post: { userId } },
      });
      return likeCount >= (criteria.count ?? 50);
    }

    case "comments_created": {
      if (event.type !== "comment_created") return false;
      const commentCount = await db.forumComment.count({ where: { userId } });
      return commentCount >= (criteria.count ?? 10);
    }

    default:
      return false;
  }
}

async function getCompletedModuleCount(userId: string): Promise<number> {
  const modules = await db.module.findMany({
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
    const completedTopics = await db.userProgress.count({
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

async function getCompletedCourseCount(userId: string): Promise<number> {
  const enrollments = await db.enrollment.count({
    where: { userId, status: "COMPLETED" },
  });
  return enrollments;
}

async function checkCategoryCompleted(
  userId: string,
  categoryName: string
): Promise<boolean> {
  const courses = await db.course.findMany({
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
      const completed = await db.userProgress.count({
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
  currentQuizId: string
): Promise<boolean> {
  const quiz = await db.quiz.findUnique({
    where: { id: currentQuizId },
    select: { courseId: true },
  });
  if (!quiz?.courseId) return false;

  const courseQuizzes = await db.quiz.findMany({
    where: { courseId: quiz.courseId, isPublished: true },
    select: { id: true, passingScore: true },
  });

  for (const q of courseQuizzes) {
    const bestAttempt = await db.quizAttempt.findFirst({
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
