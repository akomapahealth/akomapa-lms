import { renderToBuffer } from "@react-pdf/renderer";
import React from "react";

import { db } from "@/lib/db";
import { CertificateTemplate } from "@/lib/certificate-template";

async function getNextCertificateNumber(): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = `GHELP-${year}-`;

  const latest = await db.certificate.findFirst({
    where: { certificateNumber: { startsWith: prefix } },
    orderBy: { certificateNumber: "desc" },
    select: { certificateNumber: true },
  });

  let nextNum = 1;
  if (latest) {
    const parts = latest.certificateNumber.split("-");
    const lastNum = parseInt(parts[2], 10);
    if (!isNaN(lastNum)) {
      nextNum = lastNum + 1;
    }
  }

  return `${prefix}${nextNum.toString().padStart(5, "0")}`;
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

  // Verify course completion
  const enrollment = await db.enrollment.findFirst({
    where: { userId, courseId, status: "COMPLETED" },
  });

  if (!enrollment) {
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
    existing?.certificateNumber ?? (await getNextCertificateNumber());
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

  // Upsert certificate record
  await db.certificate.upsert({
    where: { userId_courseId: { userId, courseId } },
    create: {
      userId,
      courseId,
      certificateNumber,
      pdfUrl,
    },
    update: {
      pdfUrl,
    },
  });

  return { certificateNumber, pdfUrl };
}
