import { testDb } from "./db";

/**
 * Real rows, in a real database.
 *
 * The unit suite's builders describe shapes; these create actual rows so that
 * foreign keys, unique constraints, cascades, and (from #43) row-level security
 * policies all apply. A fixture that a constraint rejects is itself a finding.
 */
let sequence = 0;
const unique = (prefix: string) => `${prefix}_${++sequence}`;

export async function aUserRow(overrides: { id?: string; role?: string } = {}) {
  const id = overrides.id ?? unique("user");
  return testDb().user.create({
    data: { id, email: `${id}@example.test`, role: overrides.role ?? "STUDENT" },
  });
}

/** A published Course with one published Module and one published Topic. */
export async function aCourseWithTopic(
  ownerId: string,
  overrides: { isPublished?: boolean; topicIsFree?: boolean; topicPublished?: boolean } = {}
) {
  const course = await testDb().course.create({
    data: {
      id: unique("course"),
      userId: ownerId,
      title: "Research Ethics",
      isPublished: overrides.isPublished ?? true,
    },
  });

  const courseModule = await testDb().module.create({
    data: {
      id: unique("module"),
      courseId: course.id,
      title: "Foundations",
      position: 1,
      isPublished: true,
    },
  });

  const topic = await testDb().topic.create({
    data: {
      id: unique("topic"),
      moduleId: courseModule.id,
      title: "Consent",
      position: 1,
      isPublished: overrides.topicPublished ?? true,
      isFree: overrides.topicIsFree ?? false,
    },
  });

  return { course, module: courseModule, topic };
}

export async function aPurchaseRow(userId: string, courseId: string) {
  return testDb().purchase.create({ data: { userId, courseId } });
}

/** A published Quiz with one question and two options, one of them correct. */
export async function aQuizWithQuestion(courseId: string) {
  const quiz = await testDb().quiz.create({
    data: {
      id: unique("quiz"),
      courseId,
      title: "Module check",
      type: "MODULE_QUIZ",
      isPublished: true,
      passingScore: 70,
    },
  });

  const question = await testDb().question.create({
    data: { id: unique("question"), quizId: quiz.id, text: "Which?", position: 1, points: 10 },
  });

  const [correct, wrong] = await Promise.all([
    testDb().questionOption.create({
      data: { id: unique("option"), questionId: question.id, text: "Right", isCorrect: true, position: 1 },
    }),
    testDb().questionOption.create({
      data: { id: unique("option"), questionId: question.id, text: "Wrong", isCorrect: false, position: 2 },
    }),
  ]);

  return { quiz, question, correct, wrong };
}

export async function anAttemptRow(userId: string, quizId: string) {
  return testDb().quizAttempt.create({ data: { userId, quizId } });
}
