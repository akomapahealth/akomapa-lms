import "server-only";

import type { Badge, Prisma, UserProgress } from "@prisma/client";

import type { Principal } from "@/lib/auth";
import { evaluateBadges, type BadgeEvent } from "@/lib/badge-service";
import { issueCertificate } from "@/lib/certificate-service";
import { db } from "@/lib/db";
import { markCourseCompleted, topicEntitlement } from "@/lib/entitlement";
import { appendEvents, type DomainEvent } from "@/lib/outbox/events";
import { recordStreakActivity } from "@/lib/streak-service";

import { isCourseComplete, isModuleComplete } from "./completion";
import { findPublishedTopicInCourse } from "./topic-access";

/**
 * The learning-completion command (#49, ADR 0004).
 *
 * Marking a Topic complete or incomplete is one command, and everything it
 * implies commits in one transaction with it:
 * - the learner's progress;
 * - whether that finishes the Module and the Course, judged on eligible content
 *   (published Topics in published Modules) by the non-vacuous rules in
 *   ./completion.ts;
 * - the Enrollment's move to COMPLETED, by the transition table;
 * - the streak, the badges it earns, and the Certificate row and number;
 * - the domain events recording each of those facts (lib/outbox).
 *
 * Nothing leaves the database here. The Certificate PDF is rendered later,
 * outside any transaction, from the stored number.
 *
 * Concurrency: every command for one learner in one Course takes the same
 * transaction-scoped advisory lock first. Without it, completing the last two
 * Topics at once let each transaction read the other's Topic as incomplete, and
 * neither finished the Course. With it, the second waits and sees the first.
 *
 * Idempotency: progress is written, and events emitted, only on an actual
 * change. Repeating a request changes nothing and records nothing. One-time
 * facts (Module, Course, Certificate, Badge) are also deduplicated by the
 * outbox and by unique constraints.
 *
 * Uncompleting a Topic changes only that Topic. A completed Course, its
 * Certificate, and earned Badges are historical facts and stay; the Enrollment
 * transition table forbids COMPLETED -> ACTIVE.
 */

export type CompletionOutcome =
  | { kind: "not_found" }
  | {
      kind: "recorded";
      progress: UserProgress;
      /** False when the request repeated the current state. */
      changed: boolean;
      /** The Module this completion finished, if it finished one. */
      completedModule: { id: string; title: string } | null;
      courseCompleted: boolean;
      certificate: { certificateId: string; certificateNumber: string } | null;
      awardedBadges: Badge[];
    };

/** How long the command may hold its transaction. */
const TRANSACTION = { maxWait: 5_000, timeout: 15_000 } as const;

/** One lock per learner per Course; the same key every command uses. */
export function completionLockKey(userId: string, courseId: string): string {
  return `learning-completion:${userId}:${courseId}`;
}

export async function setTopicCompletion(
  principal: Principal,
  courseId: string,
  topicId: string,
  isCompleted: boolean,
  now: Date = new Date()
): Promise<CompletionOutcome> {
  // Published, in this Course, and readable by this learner. One answer for
  // "absent", "elsewhere", and "not yours", so the route is no oracle.
  const topic = await findPublishedTopicInCourse(courseId, topicId);
  if (!topic) return { kind: "not_found" };

  const entitlement = await topicEntitlement(principal, courseId, topicId);
  if (!entitlement.canReadTopic) return { kind: "not_found" };

  const { userId } = principal;

  return db.$transaction(
    (tx) => completeInTransaction(tx, { userId, courseId, topicId, moduleId: topic.moduleId, isCompleted, now }),
    TRANSACTION
  );
}

interface Command {
  userId: string;
  courseId: string;
  topicId: string;
  moduleId: string;
  isCompleted: boolean;
  now: Date;
}

async function completeInTransaction(
  tx: Prisma.TransactionClient,
  command: Command
): Promise<CompletionOutcome> {
  const { userId, courseId, topicId, moduleId, isCompleted, now } = command;

  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${completionLockKey(userId, courseId)}, 0))`;

  const previous = await tx.userProgress.findUnique({
    where: { userId_topicId: { userId, topicId } },
  });

  if (previous !== null && previous.isCompleted === isCompleted) {
    return {
      kind: "recorded",
      progress: previous,
      changed: false,
      completedModule: null,
      courseCompleted: false,
      certificate: null,
      awardedBadges: [],
    };
  }

  const progress = await tx.userProgress.upsert({
    where: { userId_topicId: { userId, topicId } },
    update: { isCompleted },
    create: { userId, topicId, isCompleted },
  });

  const events: DomainEvent[] = [
    {
      type: isCompleted ? "TOPIC_COMPLETED" : "TOPIC_UNCOMPLETED",
      payload: { userId, courseId, topicId },
    },
  ];

  if (!isCompleted) {
    await appendEvents(tx, events);
    return {
      kind: "recorded",
      progress,
      changed: true,
      completedModule: null,
      courseCompleted: false,
      certificate: null,
      awardedBadges: [],
    };
  }

  // Eligible content, read inside the transaction so it includes the progress
  // row just written.
  const modules = await tx.module.findMany({
    where: { courseId, isPublished: true },
    select: {
      id: true,
      title: true,
      topics: {
        where: { isPublished: true },
        select: { id: true, userProgress: { where: { userId }, select: { isCompleted: true } } },
      },
    },
  });
  const asCompletion = (m: (typeof modules)[number]) => ({
    topics: m.topics.map((t) => ({ id: t.id, completed: t.userProgress.some((p) => p.isCompleted) })),
  });

  const owning = modules.find((m) => m.id === moduleId);
  const moduleDone = owning !== undefined && isModuleComplete(asCompletion(owning), topicId);
  const courseDone = isCourseComplete(modules.map(asCompletion), topicId);

  const currentStreak = await recordStreakActivity(tx, userId, now);
  const badgeEvents: BadgeEvent[] = [
    { type: "topic_completed", topicId },
    { type: "streak_updated", currentStreak },
  ];

  if (moduleDone) {
    events.push({ type: "MODULE_COMPLETED", payload: { userId, courseId, moduleId } });
    badgeEvents.push({ type: "module_completed", moduleId });
  }

  let courseCompleted = false;
  let certificate: { certificateId: string; certificateNumber: string } | null = null;

  if (courseDone) {
    // Only an ACTIVE Enrollment is promoted. A preview learner has none, and a
    // SUSPENDED one stays suspended; neither completes the Course.
    courseCompleted = await markCourseCompleted(userId, courseId, tx);

    if (courseCompleted) {
      events.push({ type: "COURSE_COMPLETED", payload: { userId, courseId } });
      badgeEvents.push({ type: "course_completed", courseId });

      const issued = await issueCertificate(tx, userId, courseId, now);
      certificate = { certificateId: issued.certificateId, certificateNumber: issued.certificateNumber };
      if (issued.created) {
        events.push({
          type: "CERTIFICATE_ISSUED",
          payload: { userId, courseId, certificateId: issued.certificateId },
        });
      }
    }
  }

  const awardedBadges: Badge[] = [];
  for (const badgeEvent of badgeEvents) {
    for (const badge of await evaluateBadges(userId, badgeEvent, tx)) {
      if (!awardedBadges.some((b) => b.id === badge.id)) awardedBadges.push(badge);
    }
  }
  for (const badge of awardedBadges) {
    events.push({ type: "BADGE_AWARDED", payload: { userId, badgeId: badge.id } });
  }

  await appendEvents(tx, events);

  return {
    kind: "recorded",
    progress,
    changed: true,
    completedModule: moduleDone && owning ? { id: owning.id, title: owning.title } : null,
    courseCompleted,
    certificate,
    awardedBadges,
  };
}
