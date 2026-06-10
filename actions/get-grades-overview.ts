import { db } from "@/lib/db";
import { getProgress } from "./get-progress";

export interface GradesOverviewItem {
  courseId: string;
  courseTitle: string;
  preTestScore: number | null;
  postTestScore: number | null;
  growth: number | null;
  progressPercent: number;
}

export const getGradesOverview = async (
  userId: string
): Promise<GradesOverviewItem[]> => {
  try {
    const purchases = await db.purchase.findMany({
      where: { userId },
      select: {
        course: {
          select: {
            id: true,
            title: true,
            quizzes: {
              where: {
                isPublished: true,
                type: { in: ["PRE_TEST", "POST_TEST"] },
              },
              select: {
                id: true,
                type: true,
                attempts: {
                  where: { userId, completedAt: { not: null } },
                  orderBy: { score: "desc" },
                  take: 1,
                  select: { score: true },
                },
              },
            },
          },
        },
      },
    });

    const items: GradesOverviewItem[] = [];

    for (const purchase of purchases) {
      const course = purchase.course;
      const progressPercent = await getProgress(userId, course.id);

      const preTest = course.quizzes.find((q) => q.type === "PRE_TEST");
      const postTest = course.quizzes.find((q) => q.type === "POST_TEST");

      const preTestScore = preTest?.attempts[0]?.score ?? null;
      const postTestScore = postTest?.attempts[0]?.score ?? null;

      let growth: number | null = null;
      if (preTestScore !== null && postTestScore !== null) {
        growth = Math.round(postTestScore - preTestScore);
      }

      items.push({
        courseId: course.id,
        courseTitle: course.title,
        preTestScore,
        postTestScore,
        growth,
        progressPercent: Math.round(progressPercent),
      });
    }

    return items;
  } catch (error) {
    console.log("[GET_GRADES_OVERVIEW]", error);
    return [];
  }
};
