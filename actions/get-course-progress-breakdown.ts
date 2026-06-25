import { db } from "@/lib/db";

export type ModuleStatus = "NOT_STARTED" | "IN_PROGRESS" | "COMPLETED";

export interface ModuleProgressBreakdown {
  moduleId: string;
  moduleTitle: string;
  position: number;
  totalTopics: number;
  completedTopics: number;
  percentage: number;
  status: ModuleStatus;
}

export interface CourseProgressBreakdown {
  courseTitle: string;
  modules: ModuleProgressBreakdown[];
  summary: {
    completed: number;
    inProgress: number;
    notStarted: number;
  };
  totalModules: number;
  percentComplete: number;
}

export const getCourseProgressBreakdown = async (
  userId: string,
  courseId: string
): Promise<CourseProgressBreakdown | null> => {
  try {
    const course = await db.course.findUnique({
      where: { id: courseId },
      select: {
        title: true,
        modules: {
          where: { isPublished: true },
          orderBy: { position: "asc" },
          select: {
            id: true,
            title: true,
            position: true,
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
        },
      },
    });

    if (!course) return null;

    let totalCompleted = 0;
    let totalTopics = 0;

    const modules: ModuleProgressBreakdown[] = course.modules.map((mod) => {
      const total = mod.topics.length;
      const completed = mod.topics.filter(
        (t) => t.userProgress[0]?.isCompleted
      ).length;

      totalCompleted += completed;
      totalTopics += total;

      let status: ModuleStatus = "NOT_STARTED";
      if (total > 0 && completed === total) {
        status = "COMPLETED";
      } else if (completed > 0) {
        status = "IN_PROGRESS";
      }

      return {
        moduleId: mod.id,
        moduleTitle: mod.title,
        position: mod.position,
        totalTopics: total,
        completedTopics: completed,
        percentage: total > 0 ? Math.round((completed / total) * 100) : 0,
        status,
      };
    });

    const summary = {
      completed: modules.filter((m) => m.status === "COMPLETED").length,
      inProgress: modules.filter((m) => m.status === "IN_PROGRESS").length,
      notStarted: modules.filter((m) => m.status === "NOT_STARTED").length,
    };

    return {
      courseTitle: course.title,
      modules,
      summary,
      totalModules: modules.length,
      percentComplete:
        totalTopics > 0
          ? Math.round((totalCompleted / totalTopics) * 100)
          : 0,
    };
  } catch (error) {
    console.log("[GET_COURSE_PROGRESS_BREAKDOWN]", error);
    return null;
  }
};
