import "server-only";

import { generateCertificate } from "@/lib/certificate-service";
import { db } from "@/lib/db";

import { EVENT_PAYLOADS, type DomainEventType, type EventPayload } from "./events";

/**
 * What each domain event causes outside the transaction that recorded it
 * (#49, ADR 0005).
 *
 * The table is exhaustive over `DomainEventType`: an event either names its
 * consumer or says, with `null`, that nothing consumes it yet -- so the #69
 * processor can mark it delivered rather than retrying it forever, and adding
 * an event forces the decision.
 *
 * Every consumer is idempotent (ADR 0005 point 2): delivering the same event
 * twice, or out of order, leaves one outcome. Each re-reads the state it needs
 * rather than trusting the payload, which carries identifiers only.
 */

export type EventHandler<T extends DomainEventType> = (payload: EventPayload<T>) => Promise<void>;

/**
 * Renders and stores the Certificate PDF.
 *
 * The completion transaction reserved the row and its number; rendering is a
 * slow CPU job that must never run inside a transaction (ADR 0004). A second
 * delivery finds the PDF already stored and does nothing; a row that no longer
 * exists, or whose learner is no longer eligible, is skipped rather than
 * retried, because no retry can change that.
 */
export const handleCertificateIssued: EventHandler<"CERTIFICATE_ISSUED"> = async (payload) => {
  const certificate = await db.certificate.findUnique({
    where: { id: payload.certificateId },
    select: { userId: true, courseId: true, pdfUrl: true },
  });

  if (certificate === null || certificate.pdfUrl !== null) return;

  await generateCertificate(certificate.userId, certificate.courseId);
};

export const EVENT_HANDLERS: { [T in DomainEventType]: EventHandler<T> | null } = {
  CERTIFICATE_ISSUED: handleCertificateIssued,
  // Recorded for analytics and notifications, which have no consumer yet:
  // there is no email capability (policy 05) and no analytics pipeline. #69
  // marks these delivered; a consumer added later reads them from the table.
  TOPIC_COMPLETED: null,
  TOPIC_UNCOMPLETED: null,
  MODULE_COMPLETED: null,
  COURSE_COMPLETED: null,
  BADGE_AWARDED: null,
  QUIZ_ATTEMPT_COMPLETED: null,
};

/**
 * Delivers one stored event to its consumer. The #69 processor calls this for
 * each claimed row; the payload is validated again on the way out, so a row
 * edited by hand cannot reach a consumer malformed.
 */
export async function dispatchEvent(type: DomainEventType, payload: unknown): Promise<void> {
  const handler = EVENT_HANDLERS[type] as EventHandler<typeof type> | null;
  if (handler === null) return;
  await handler(EVENT_PAYLOADS[type].parse(payload) as never);
}
