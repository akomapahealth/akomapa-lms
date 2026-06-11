import { db } from "@/lib/db";

export interface LearningPathCourse {
  id: string;
  title: string;
  description: string | null;
  imageUrl: string | null;
  totalTopics: number;
  completedTopics: number;
  isEnrolled: boolean;
  status: "NOT_STARTED" | "IN_PROGRESS" | "COMPLETED";
}

export const getLearningPath = async (
  userId: string
): Promise<LearningPathCourse[]> => {
  try {
    const courses = await db.course.findMany({
      where: { isPublished: true },
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        title: true,
        description: true,
        imageUrl: true,
        modules: {
          where: { isPublished: true },
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
        },
        enrollments: {
          where: { userId },
          select: { status: true },
        },
      },
    });

    return courses.map((course) => {
      const allTopics = course.modules.flatMap((m) => m.topics);
      const totalTopics = allTopics.length;
      const completedTopics = allTopics.filter(
        (t) => t.userProgress[0]?.isCompleted
      ).length;

      const enrollment = course.enrollments[0];
      const isEnrolled = !!enrollment;

      let status: "NOT_STARTED" | "IN_PROGRESS" | "COMPLETED" = "NOT_STARTED";
      if (enrollment?.status === "COMPLETED") {
        status = "COMPLETED";
      } else if (isEnrolled && completedTopics > 0) {
        status = "IN_PROGRESS";
      } else if (isEnrolled) {
        status = "NOT_STARTED";
      }

      return {
        id: course.id,
        title: course.title,
        description: course.description,
        imageUrl: course.imageUrl,
        totalTopics,
        completedTopics,
        isEnrolled,
        status,
      };
    });
  } catch (error) {
    console.log("[GET_LEARNING_PATH]", error);
    return [];
  }
};
