import { db } from "@/lib/db";

export type ModuleGradeStatus = "NOT_STARTED" | "IN_PROGRESS" | "COMPLETED";

export interface ModuleGrade {
  moduleId: string;
  moduleTitle: string;
  totalTopics: number;
  completedTopics: number;
  quizScore: number | null;
  status: ModuleGradeStatus;
}

export interface QuizAttemptRecord {
  attemptId: string;
  quizId: string;
  quizTitle: string;
  quizType: string;
  date: Date;
  score: number;
  totalPoints: number;
  percentage: number;
  passed: boolean;
  timeTaken: string; // "MM:SS" format
}

export interface GradesDetail {
  courseTitle: string;
  courseId: string;
  preTestScore: number | null;
  postTestScore: number | null;
  modules: ModuleGrade[];
  attempts: QuizAttemptRecord[];
}

export const getGradesDetail = async (
  userId: string,
  courseId: string
): Promise<GradesDetail | null> => {
  try {
    const course = await db.course.findUnique({
      where: { id: courseId },
      select: {
        id: true,
        title: true,
        modules: {
          where: { isPublished: true },
          orderBy: { position: "asc" },
          select: {
            id: true,
            title: true,
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
            quizzes: {
              where: { isPublished: true },
              select: {
                attempts: {
                  where: { userId, completedAt: { not: null } },
                  orderBy: { score: "desc" },
                  take: 1,
                  select: { score: true, totalPoints: true },
                },
              },
            },
          },
        },
        quizzes: {
          where: { isPublished: true },
          select: {
            id: true,
            title: true,
            type: true,
            passingScore: true,
            attempts: {
              where: { userId, completedAt: { not: null } },
              orderBy: { completedAt: "desc" },
              select: {
                id: true,
                score: true,
                totalPoints: true,
                startedAt: true,
                completedAt: true,
              },
            },
          },
        },
      },
    });

    if (!course) return null;

    // Build module grades
    const modules: ModuleGrade[] = course.modules.map((mod) => {
      const totalTopics = mod.topics.length;
      const completedTopics = mod.topics.filter(
        (t) => t.userProgress[0]?.isCompleted
      ).length;

      const bestQuizAttempt = mod.quizzes[0]?.attempts[0];
      const quizScore =
        bestQuizAttempt && bestQuizAttempt.totalPoints
          ? Math.round(
              (bestQuizAttempt.score! / bestQuizAttempt.totalPoints) * 100
            )
          : null;

      let status: ModuleGradeStatus = "NOT_STARTED";
      if (totalTopics > 0 && completedTopics === totalTopics) {
        status = "COMPLETED";
      } else if (completedTopics > 0) {
        status = "IN_PROGRESS";
      }

      return {
        moduleId: mod.id,
        moduleTitle: mod.title,
        totalTopics,
        completedTopics,
        quizScore,
        status,
      };
    });

    // Build attempt history
    const attempts: QuizAttemptRecord[] = [];
    for (const quiz of course.quizzes) {
      for (const attempt of quiz.attempts) {
        const totalPoints = attempt.totalPoints ?? 1;
        const score = attempt.score ?? 0;
        const percentage = Math.round((score / totalPoints) * 100);

        // Calculate time taken
        const startMs = attempt.startedAt.getTime();
        const endMs = attempt.completedAt!.getTime();
        const diffSec = Math.floor((endMs - startMs) / 1000);
        const minutes = Math.floor(diffSec / 60);
        const seconds = diffSec % 60;
        const timeTaken = `${minutes}:${seconds.toString().padStart(2, "0")}`;

        attempts.push({
          attemptId: attempt.id,
          quizId: quiz.id,
          quizTitle: quiz.title,
          quizType: quiz.type,
          date: attempt.completedAt!,
          score,
          totalPoints,
          percentage,
          passed: percentage >= quiz.passingScore,
          timeTaken,
        });
      }
    }

    // Sort attempts by date descending
    attempts.sort((a, b) => b.date.getTime() - a.date.getTime());

    // Get pre/post test best scores
    const preTest = course.quizzes.find((q) => q.type === "PRE_TEST");
    const postTest = course.quizzes.find((q) => q.type === "POST_TEST");

    const bestPreAttempt = preTest?.attempts[0];
    const bestPostAttempt = postTest?.attempts[0];

    const preTestScore =
      bestPreAttempt && bestPreAttempt.totalPoints
        ? Math.round(
            (bestPreAttempt.score! / bestPreAttempt.totalPoints) * 100
          )
        : null;

    const postTestScore =
      bestPostAttempt && bestPostAttempt.totalPoints
        ? Math.round(
            (bestPostAttempt.score! / bestPostAttempt.totalPoints) * 100
          )
        : null;

    return {
      courseTitle: course.title,
      courseId: course.id,
      preTestScore,
      postTestScore,
      modules,
      attempts,
    };
  } catch (error) {
    console.log("[GET_GRADES_DETAIL]", error);
    return null;
  }
};
