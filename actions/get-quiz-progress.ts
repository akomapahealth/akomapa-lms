import { db } from "@/lib/db";

export type QuizStatus = "NOT_ATTEMPTED" | "PASSED" | "FAILED";

export interface QuizProgressItem {
  quizId: string;
  title: string;
  type: string;
  moduleName: string | null;
  passingScore: number;
  bestScore: number | null;
  attemptCount: number;
  status: QuizStatus;
}

export const getQuizProgress = async (
  userId: string,
  courseId: string
): Promise<QuizProgressItem[]> => {
  try {
    const quizzes = await db.quiz.findMany({
      where: {
        OR: [
          { courseId },
          {
            module: {
              courseId,
            },
          },
        ],
        isPublished: true,
      },
      include: {
        module: {
          select: { title: true },
        },
        attempts: {
          where: { userId },
          orderBy: { score: "desc" },
        },
      },
      orderBy: { createdAt: "asc" },
    });

    return quizzes.map((quiz) => {
      const bestAttempt = quiz.attempts[0];
      const bestScore = bestAttempt?.score ?? null;
      const attemptCount = quiz.attempts.length;

      let status: QuizStatus = "NOT_ATTEMPTED";
      if (bestScore !== null) {
        status = bestScore >= quiz.passingScore ? "PASSED" : "FAILED";
      }

      return {
        quizId: quiz.id,
        title: quiz.title,
        type: quiz.type,
        moduleName: quiz.module?.title ?? null,
        passingScore: quiz.passingScore,
        bestScore,
        attemptCount,
        status,
      };
    });
  } catch (error) {
    console.log("[GET_QUIZ_PROGRESS]", error);
    return [];
  }
};
