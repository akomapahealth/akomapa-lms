import { renderToBuffer } from "@react-pdf/renderer";
import type { Prisma } from "@prisma/client";
import React from "react";

import { db } from "@/lib/db";
import { CertificateTemplate } from "@/lib/certificate-template";
import { enrollmentStatusFor } from "@/lib/entitlement";

/** The prefix every generated Certificate number shares. */
const CERTIFICATE_PREFIX = "GHELP";

/** `GHELP-2026-00042`: the year, then the year's sequence, five digits wide. */
export function formatCertificateNumber(year: number, sequence: number): string {
  return `${CERTIFICATE_PREFIX}-${year}-${sequence.toString().padStart(5, "0")}`;
}

/** Any client that can allocate and insert: the shared one, or a transaction. */
type CertificateClient = Pick<Prisma.TransactionClient, "$queryRaw" | "certificate">;

/**
 * Allocates the next number for a year, atomically (#51).
 *
 * One statement: the first allocation in a year inserts 1, every later one
 * increments under the row lock, so concurrent Certificates can never share a
 * number. A number whose Certificate then fails to save is not reused; gaps are
 * harmless, duplicates are not.
 */
export async function allocateCertificateNumber(
  now: Date = new Date(),
  client: Pick<Prisma.TransactionClient, "$queryRaw"> = db
): Promise<string> {
  const year = now.getUTCFullYear();
  const [row] = await client.$queryRaw<{ lastValue: number }[]>`
    INSERT INTO "CertificateNumberSequence" ("year", "lastValue")
    VALUES (${year}, 1)
    ON CONFLICT ("year") DO UPDATE
      SET "lastValue" = "CertificateNumberSequence"."lastValue" + 1
    RETURNING "lastValue"
  `;
  return formatCertificateNumber(year, Number(row.lastValue));
}

export interface IssuedCertificate {
  certificateId: string;
  certificateNumber: string;
  /** False when the learner already held this Certificate. */
  created: boolean;
}

/**
 * The learner's Certificate row for a Course, created if absent, with its
 * permanent number -- and no PDF yet (#49, #51).
 *
 * Safe inside the completion transaction (ADR 0004): the insert is
 * `ON CONFLICT DO NOTHING`, so a Certificate created concurrently by the
 * on-demand route never raises -- in PostgreSQL a failed statement aborts the
 * whole transaction, which would roll back the completion with it. The loser
 * reads the winner's row. The PDF is rendered later, outside any transaction
 * (`generateCertificate`, and the CERTIFICATE_ISSUED handler), so the PDF
 * always shows the number the database holds.
 */
export async function issueCertificate(
  client: CertificateClient,
  userId: string,
  courseId: string,
  now: Date = new Date()
): Promise<IssuedCertificate> {
  const where = { userId_courseId: { userId, courseId } };
  const existing = await client.certificate.findUnique({
    where,
    select: { id: true, certificateNumber: true },
  });
  if (existing) {
    return { certificateId: existing.id, certificateNumber: existing.certificateNumber, created: false };
  }

  const certificateNumber = await allocateCertificateNumber(now, client);
  const certificateId = globalThis.crypto.randomUUID();
  const inserted = await client.$queryRaw<{ id: string }[]>`
    INSERT INTO "Certificate" ("id", "userId", "courseId", "certificateNumber")
    VALUES (${certificateId}, ${userId}, ${courseId}, ${certificateNumber})
    ON CONFLICT ("userId", "courseId") DO NOTHING
    RETURNING "id"
  `;
  if (inserted.length > 0) return { certificateId, certificateNumber, created: true };

  const winner = await client.certificate.findUnique({
    where,
    select: { id: true, certificateNumber: true },
  });
  // ON CONFLICT on (userId, courseId) inserted nothing, so a row exists; a
  // missing one means it was deleted in between, which RESTRICT forbids.
  if (winner === null) throw new Error("certificate conflict without a certificate");
  return { certificateId: winner.id, certificateNumber: winner.certificateNumber, created: false };
}

export async function generateCertificate(
  userId: string,
  courseId: string
): Promise<{ certificateNumber: string; pdfUrl: string } | null> {
  // Check if certificate already exists
  const existing = await db.certificate.findUnique({
    where: { userId_courseId: { userId, courseId } },
  });

  if (existing?.pdfUrl) {
    return {
      certificateNumber: existing.certificateNumber,
      pdfUrl: existing.pdfUrl,
    };
  }

  // Certificate eligibility is an access decision, so it goes through the
  // entitlement module rather than comparing a raw status column here (ADR 0002
  // point 1). A `COMPLETED` Enrollment is what earns a Certificate.
  if ((await enrollmentStatusFor(userId, courseId)) !== "COMPLETED") {
    return null;
  }

  // Get student info
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { firstName: true, lastName: true },
  });

  // Get course info
  const course = await db.course.findUnique({
    where: { id: courseId },
    select: {
      title: true,
      quizzes: {
        where: { isPublished: true },
        select: {
          type: true,
          attempts: {
            where: { userId, completedAt: { not: null } },
            orderBy: { score: "desc" },
            take: 1,
            select: { score: true, totalPoints: true },
          },
        },
      },
    },
  });

  if (!course) return null;

  // Calculate scores
  const preTest = course.quizzes.find((q) => q.type === "PRE_TEST");
  const postTest = course.quizzes.find((q) => q.type === "POST_TEST");

  const preTestScore =
    preTest?.attempts[0] && preTest.attempts[0].totalPoints
      ? Math.round(
          ((preTest.attempts[0].score ?? 0) / preTest.attempts[0].totalPoints) *
            100
        )
      : null;

  const postTestScore =
    postTest?.attempts[0] && postTest.attempts[0].totalPoints
      ? Math.round(
          ((postTest.attempts[0].score ?? 0) /
            postTest.attempts[0].totalPoints) *
            100
        )
      : null;

  const certificateNumber =
    existing?.certificateNumber ?? (await issueCertificate(db, userId, courseId)).certificateNumber;
  const issuedDate = new Date().toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  // Generate PDF
  const studentName = [user?.firstName, user?.lastName]
    .filter(Boolean)
    .join(" ") || "Student";

  const pdfElement = React.createElement(CertificateTemplate, {
    studentName,
    courseTitle: course.title,
    preTestScore,
    postTestScore,
    certificateNumber,
    issuedDate,
  }) as unknown as React.ReactElement;

  const pdfBuffer = await renderToBuffer(pdfElement);

  // Convert to base64 data URL for storage
  const base64 = Buffer.from(pdfBuffer).toString("base64");
  const pdfUrl = `data:application/pdf;base64,${base64}`;

  // The row and its number exist already (reserved above, or found); only the
  // rendered PDF is new.
  await db.certificate.update({
    where: { userId_courseId: { userId, courseId } },
    data: { pdfUrl },
  });

  return { certificateNumber, pdfUrl };
}
