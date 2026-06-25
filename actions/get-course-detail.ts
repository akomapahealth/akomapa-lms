import { db } from "@/lib/db";

export interface TopicDetail {
  id: string;
  title: string;
  position: number;
  isFree: boolean;
  isCompleted: boolean;
}

export interface ModuleDetail {
  id: string;
  title: string;
  position: number;
  description: string | null;
  topics: TopicDetail[];
  totalTopics: number;
  completedTopics: number;
  percentage: number;
}

export interface CourseDetailData {
  id: string;
  title: string;
  description: string | null;
  imageUrl: string | null;
  categoryName: string | null;
  modules: ModuleDetail[];
  totalModules: number;
  totalTopics: number;
  completedTopics: number;
  totalQuizzes: number;
  percentComplete: number;
  resumeTopicId: string | null;
  isPurchased: boolean;
  price: number | null;
}

export const getCourseDetail = async (
  userId: string,
  courseId: string
): Promise<CourseDetailData | null> => {
  try {
    const course = await db.course.findUnique({
      where: { id: courseId, isPublished: true },
      include: {
        category: true,
        quizzes: { where: { isPublished: true } },
        modules: {
          where: { isPublished: true },
          orderBy: { position: "asc" },
          include: {
            topics: {
              where: { isPublished: true },
              orderBy: { position: "asc" },
              include: {
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

    const purchase = await db.purchase.findUnique({
      where: {
        userId_courseId: { userId, courseId },
      },
    });

    let totalTopics = 0;
    let completedTopics = 0;
    let resumeTopicId: string | null = null;

    const modules: ModuleDetail[] = course.modules.map((mod) => {
      const topics: TopicDetail[] = mod.topics.map((topic) => {
        const isCompleted = !!topic.userProgress[0]?.isCompleted;
        totalTopics++;
        if (isCompleted) completedTopics++;
        if (!isCompleted && !resumeTopicId) {
          resumeTopicId = topic.id;
        }
        return {
          id: topic.id,
          title: topic.title,
          position: topic.position,
          isFree: topic.isFree,
          isCompleted,
        };
      });

      const modCompleted = topics.filter((t) => t.isCompleted).length;

      return {
        id: mod.id,
        title: mod.title,
        position: mod.position,
        description: mod.description,
        topics,
        totalTopics: topics.length,
        completedTopics: modCompleted,
        percentage:
          topics.length > 0
            ? Math.round((modCompleted / topics.length) * 100)
            : 0,
      };
    });

    // If all topics are completed, resume from the first topic
    if (!resumeTopicId && modules.length > 0 && modules[0].topics.length > 0) {
      resumeTopicId = modules[0].topics[0].id;
    }

    return {
      id: course.id,
      title: course.title,
      description: course.description,
      imageUrl: course.imageUrl,
      categoryName: course.category?.name ?? null,
      modules,
      totalModules: modules.length,
      totalTopics,
      completedTopics,
      totalQuizzes: course.quizzes.length,
      percentComplete:
        totalTopics > 0
          ? Math.round((completedTopics / totalTopics) * 100)
          : 0,
      resumeTopicId,
      isPurchased: !!purchase,
      price: course.price,
    };
  } catch (error) {
    console.log("[GET_COURSE_DETAIL]", error);
    return null;
  }
};
