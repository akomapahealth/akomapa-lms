import { testDb } from "./db";

/**
 * Real rows, in a real database.
 *
 * The unit suite's builders describe shapes; these create actual rows so that
 * foreign keys, unique constraints, cascades, and (from #43) row-level security
 * policies all apply. A fixture that a constraint rejects is itself a finding.
 */
let sequence = 0;

/**
 * A Clerk-shaped user id. `User.id` is the Clerk subject, not a uuid.
 */
const uniqueUser = (prefix: string) => `${prefix}_${++sequence}`;

/**
 * A real uuid for every other model.
 *
 * Every model except `User` declares `@default(uuid())`, so production ids are
 * uuids. These fixtures used to mint `course_1`-style ids, which meant the suite
 * exercised shapes the application never actually sees -- and once #44 began
 * validating path params as uuids, those ids were rejected before any handler
 * logic ran. Matching production is both more honest and what keeps the strict
 * parameter validation testable.
 */
const unique = () => globalThis.crypto.randomUUID();

export async function aUserRow(overrides: { id?: string; role?: string } = {}) {
  const id = overrides.id ?? uniqueUser("user");
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
      id: unique(),
      userId: ownerId,
      title: "Research Ethics",
      isPublished: overrides.isPublished ?? true,
    },
  });

  const courseModule = await testDb().module.create({
    data: {
      id: unique(),
      courseId: course.id,
      title: "Foundations",
      position: 1,
      isPublished: true,
    },
  });

  const topic = await testDb().topic.create({
    data: {
      id: unique(),
      moduleId: courseModule.id,
      title: "Consent",
      position: 1,
      isPublished: overrides.topicPublished ?? true,
      isFree: overrides.topicIsFree ?? false,
    },
  });

  return { course, module: courseModule, topic };
}

/**
 * Evidence of payment, and nothing more.
 *
 * Since #48 this grants no access on its own (ADR 0002). A test that means "this
 * learner can open the Course" wants `anEnrollmentRow`; a test that means "this
 * learner paid but has no Enrollment" -- the state the backfill exists for --
 * wants this one alone.
 */
export async function aPurchaseRow(userId: string, courseId: string) {
  return testDb().purchase.create({ data: { userId, courseId } });
}

/** The entitlement. `status` decides whether it grants access. */
export async function anEnrollmentRow(
  userId: string,
  courseId: string,
  status: "ACTIVE" | "COMPLETED" | "SUSPENDED" = "ACTIVE"
) {
  return testDb().enrollment.create({ data: { userId, courseId, status } });
}

/** A learner who paid and is enrolled: what the Stripe path now writes. */
export async function aPaidEnrollment(
  userId: string,
  courseId: string,
  status: "ACTIVE" | "COMPLETED" | "SUSPENDED" = "ACTIVE"
) {
  await aPurchaseRow(userId, courseId);
  return anEnrollmentRow(userId, courseId, status);
}

/** A published Quiz with one question and two options, one of them correct. */
export async function aQuizWithQuestion(courseId: string) {
  const quiz = await testDb().quiz.create({
    data: {
      id: unique(),
      courseId,
      title: "Module check",
      type: "MODULE_QUIZ",
      isPublished: true,
      passingScore: 70,
    },
  });

  const question = await testDb().question.create({
    data: { id: unique(), quizId: quiz.id, text: "Which?", position: 1, points: 10 },
  });

  const [correct, wrong] = await Promise.all([
    testDb().questionOption.create({
      data: { id: unique(), questionId: question.id, text: "Right", isCorrect: true, position: 1 },
    }),
    testDb().questionOption.create({
      data: { id: unique(), questionId: question.id, text: "Wrong", isCorrect: false, position: 2 },
    }),
  ]);

  return { quiz, question, correct, wrong };
}

export async function anAttemptRow(userId: string, quizId: string) {
  return testDb().quizAttempt.create({ data: { userId, quizId } });
}

/** A Topic with a Case Study attached, for the authoring routes. */
export async function aCaseStudyRow(topicId: string, scenario: unknown) {
  return testDb().caseStudy.create({
    data: {
      id: unique(),
      topicId,
      title: "Consent in the field",
      description: "A scenario",
      scenario: scenario as never,
    },
  });
}
