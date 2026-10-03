import { db } from "@/lib/db";
import { summarizeCompletion } from "@/lib/courses/completion";
import { logError } from "@/lib/logger";

/**
 * Whether a learner may start the Course's Post-Test: only once every eligible
 * Topic is complete, by the same rule that completes the Course (#49).
 *
 * Fails closed: if progress cannot be read, the Post-Test stays locked.
 */
export async function isPostTestUnlocked(
  userId: string,
  courseId: string
): Promise<{ unlocked: boolean; completedModules: number; totalModules: number }> {
  try {
    const modules = await db.module.findMany({
      where: { courseId, isPublished: true },
      select: {
        topics: {
          where: { isPublished: true },
          select: {
            id: true,
            userProgress: {
              where: { userId },
              select: { isCompleted: true },
            },
          },
        },
      },
    });

    const summary = summarizeCompletion(
      modules.map((courseModule) => ({
        topics: courseModule.topics.map((topic) => ({
          id: topic.id,
          completed: topic.userProgress.some((p) => p.isCompleted),
        })),
      }))
    );

    return {
      unlocked: summary.courseComplete,
      completedModules: summary.completedModules,
      totalModules: summary.countedModules,
    };
  } catch (error) {
    logError("CHECK_POST_TEST_LOCK", error);
    return { unlocked: false, completedModules: 0, totalModules: 0 };
  }
}
