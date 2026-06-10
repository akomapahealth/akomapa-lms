import { db } from "@/lib/db";

export async function isPostTestUnlocked(
  userId: string,
  courseId: string
): Promise<{ unlocked: boolean; completedModules: number; totalModules: number }> {
  try {
    const modules = await db.module.findMany({
      where: { courseId, isPublished: true },
      include: {
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

    let completedModules = 0;
    for (const mod of modules) {
      const allComplete =
        mod.topics.length > 0 &&
        mod.topics.every((t) => t.userProgress.some((p) => p.isCompleted));
      if (allComplete) completedModules++;
    }

    return {
      unlocked: modules.length > 0 && completedModules === modules.length,
      completedModules,
      totalModules: modules.length,
    };
  } catch (error) {
    console.log("[CHECK_POST_TEST_LOCK]", error);
    return { unlocked: false, completedModules: 0, totalModules: 0 };
  }
}
