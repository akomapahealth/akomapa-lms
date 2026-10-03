import "server-only";

import type { Prisma } from "@prisma/client";

import { db } from "@/lib/db";
import { EnrollmentStatus, enrollmentSourcesFor } from "@/lib/domain/states";

/**
 * Creating entitlement (#48, ADR 0002).
 *
 * Payment is an input that creates an Enrollment, never a substitute for one. The
 * Stripe webhook used to write only a `Purchase` row, which was enough while
 * access was read from `Purchase`. Once `Enrollment` is canonical, a payment that
 * records no Enrollment buys nothing -- so the two are written together.
 *
 * Full reconciliation of provider events (duplicate delivery, reordering,
 * out-of-order refunds) is #54 and #69. What this module owns is that the pair is
 * written atomically and that writing it twice is harmless.
 */

/**
 * Records a paid enrolment: the `Purchase` as evidence, the `Enrollment` as the
 * entitlement.
 *
 * Idempotent, because a webhook is delivered at least once. Both writes are
 * upserts inside one transaction, so a redelivery changes nothing and a partial
 * failure leaves neither row -- the state that used to be possible was a
 * `Purchase` with no `Enrollment`, which reads as "paid but locked out".
 *
 * An existing Enrollment is deliberately **not** reset to `ACTIVE`. A learner who
 * was suspended, or who has already completed the Course, must not have that
 * status overwritten by a webhook redelivery.
 */
export async function recordPaidEnrollment(
  userId: string,
  courseId: string,
  tx?: Prisma.TransactionClient
): Promise<void> {
  const run = async (client: Prisma.TransactionClient) => {
    await client.purchase.upsert({
      where: { userId_courseId: { userId, courseId } },
      create: { userId, courseId },
      update: {},
    });

    await client.enrollment.upsert({
      where: { userId_courseId: { userId, courseId } },
      create: { userId, courseId, status: EnrollmentStatus.ACTIVE },
      // Left alone on purpose: see the note above about SUSPENDED and COMPLETED.
      update: {},
    });
  };

  if (tx) return run(tx);
  await db.$transaction(run);
}

/**
 * Enrols a learner with no payment: a free Course, a scholarship, a staff account.
 *
 * ADR 0002 point 8: free Courses stop being a special case in access code; they
 * are Courses whose Enrollment is created without a payment step. No `Purchase`
 * row is written, because none happened.
 */
export async function recordFreeEnrollment(
  userId: string,
  courseId: string,
  tx?: Prisma.TransactionClient
): Promise<void> {
  const client = tx ?? db;
  await client.enrollment.upsert({
    where: { userId_courseId: { userId, courseId } },
    create: { userId, courseId, status: EnrollmentStatus.ACTIVE },
    update: {},
  });
}

/**
 * Marks an Enrollment `COMPLETED`.
 *
 * Only ever promotes from `ACTIVE`. A `SUSPENDED` learner does not complete a
 * Course by finishing its Topics -- the previous `updateMany` matched on
 * (userId, courseId) alone, so a suspended learner who still had progress rows
 * could be flipped to `COMPLETED` and become eligible for a Certificate.
 *
 * Returns whether a row changed, so a caller can decide whether the
 * completion-once side effects should run.
 */
export async function markCourseCompleted(
  userId: string,
  courseId: string,
  tx?: Prisma.TransactionClient
): Promise<boolean> {
  const client = tx ?? db;
  const result = await client.enrollment.updateMany({
    // The transition table decides the source statuses (only ACTIVE), and the
    // conditional update applies it atomically.
    where: { userId, courseId, status: { in: enrollmentSourcesFor(EnrollmentStatus.COMPLETED) } },
    data: { status: EnrollmentStatus.COMPLETED },
  });

  return result.count > 0;
}

/**
 * Whether any Purchase or Enrollment references this Course (#51).
 *
 * Both are records the Course cannot be deleted out from under: a Purchase is
 * payment evidence kept for seven years (policy 02), and an Enrollment is the
 * learner's entitlement and its history (ADR 0002). Lives here because this
 * module is the only one that reads those tables; it decides deletability, not
 * access.
 */
export async function courseHasEntitlementRecords(
  courseId: string,
  tx?: Prisma.TransactionClient
): Promise<boolean> {
  const client = tx ?? db;
  const [purchase, enrollment] = await Promise.all([
    client.purchase.findFirst({ where: { courseId }, select: { id: true } }),
    client.enrollment.findFirst({ where: { courseId }, select: { id: true } }),
  ]);
  return purchase !== null || enrollment !== null;
}

