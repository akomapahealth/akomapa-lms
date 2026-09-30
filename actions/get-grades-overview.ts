import type { Principal } from "@/lib/auth";
import { db } from "@/lib/db";
import { entitledCourseIds } from "@/lib/entitlement";
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
  principal: Principal
): Promise<GradesOverviewItem[]> => {
  try {
    const userId = principal.userId;

    // Entitled Courses (ADR 0002). Grades were listed from `Purchase`, so a
    // suspended learner still saw their scores for a Course they cannot open.
    const courseIds = await entitledCourseIds(principal);
    if (courseIds.length === 0) return [];

    const entitledCourses = await db.course.findMany({
      where: { id: { in: courseIds } },
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
    });

    const items: GradesOverviewItem[] = [];

    for (const course of entitledCourses) {
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
