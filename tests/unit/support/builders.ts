import type {
  Badge,
  Certificate,
  Enrollment,
  LearningStreak,
  Quiz,
  QuizAttempt,
  User,
} from "@prisma/client";

/**
 * Domain builders.
 *
 * Every builder returns a valid, boring entity and takes an override patch, so
 * a test states only the field it is actually about. `aUser({ role: "ADMIN" })`
 * reads as an assertion about roles; a 12-field object literal does not.
 *
 * Identifiers are stable strings rather than random UUIDs — a failure message
 * naming `course_1` is traceable, one naming a fresh UUID is not.
 */

const EPOCH = new Date("2026-01-01T00:00:00.000Z");

function timestamps() {
  return { createdAt: EPOCH, updatedAt: EPOCH };
}

export type Role = "STUDENT" | "FACULTY" | "ADMIN";

export function aUser(overrides: Partial<User> = {}): User {
  return {
    id: "user_1",
    email: "learner@example.test",
    firstName: "Ama",
    lastName: "Mensah",
    imageUrl: null,
    role: "STUDENT",
    bio: null,
    title: null,
    specialization: null,
    ...timestamps(),
    ...overrides,
  } as User;
}

/** The narrow projection `lib/roles.ts` actually selects. */
export function aRoleRow(role: Role | string | null): { role: string } | null {
  return role === null ? null : { role };
}

export function anEnrollment(overrides: Partial<Enrollment> = {}): Enrollment {
  return {
    id: "enrollment_1",
    userId: "user_1",
    courseId: "course_1",
    status: "ACTIVE",
    enrolledAt: EPOCH,
    ...timestamps(),
    ...overrides,
  } as Enrollment;
}

export function aLearningStreak(
  overrides: Partial<LearningStreak> = {}
): LearningStreak {
  return {
    id: "streak_1",
    userId: "user_1",
    currentStreak: 1,
    longestStreak: 1,
    lastActivityDate: null,
    updatedAt: EPOCH,
    ...overrides,
  } as LearningStreak;
}

export function aBadge(overrides: Partial<Badge> = {}): Badge {
  return {
    id: "badge_1",
    name: "First Steps",
    description: "Complete your first Topic.",
    imageUrl: null,
    type: "COMPLETION",
    criteria: { type: "topics_completed", count: 1 },
    ...timestamps(),
    ...overrides,
  } as Badge;
}

/** A badge whose criteria are stated inline, which is what most tests want. */
export function aBadgeWithCriteria(
  criteria: Record<string, unknown>,
  overrides: Partial<Badge> = {}
): Badge {
  return aBadge({ criteria, ...overrides } as Partial<Badge>);
}

export function aQuiz(overrides: Partial<Quiz> = {}): Quiz {
  return {
    id: "quiz_1",
    title: "Module 1 Check",
    type: "MODULE_QUIZ",
    timeLimitMinutes: null,
    passingScore: 70,
    isPublished: true,
    courseId: "course_1",
    moduleId: null,
    ...timestamps(),
    ...overrides,
  } as Quiz;
}

export function aQuizAttempt(overrides: Partial<QuizAttempt> = {}): QuizAttempt {
  return {
    id: "attempt_1",
    score: 80,
    totalPoints: 100,
    startedAt: EPOCH,
    completedAt: EPOCH,
    userId: "user_1",
    quizId: "quiz_1",
    ...timestamps(),
    ...overrides,
  } as QuizAttempt;
}

export function aCertificate(
  overrides: Partial<Certificate> = {}
): Certificate {
  return {
    id: "certificate_1",
    certificateNumber: "GHELP-2026-00001",
    issuedAt: EPOCH,
    userId: "user_1",
    courseId: "course_1",
    pdfUrl: null,
    ...overrides,
  } as Certificate;
}

/** A published Module with published Topics, shaped as badge-service selects it. */
export function aModuleWithTopics(
  topicIds: string[],
  overrides: Record<string, unknown> = {}
) {
  return {
    id: "module_1",
    isPublished: true,
    topics: topicIds.map((id) => ({ id })),
    ...overrides,
  };
}
