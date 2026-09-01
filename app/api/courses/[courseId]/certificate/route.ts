import { NextResponse } from "next/server";

import { db } from "@/lib/db";
import { requirePrincipal, toResponse } from "@/lib/auth";
import { generateCertificate } from "@/lib/certificate-service";
import { logError } from "@/lib/logger";

export const maxDuration = 30;

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ courseId: string }> }
) {
  try {
    const { userId } = await requirePrincipal();

    const { courseId } = await params;

    // Verify enrollment completion
    const enrollment = await db.enrollment.findFirst({
      where: { userId, courseId, status: "COMPLETED" },
    });

    if (!enrollment) {
      return NextResponse.json(
        { error: "Course not completed" },
        { status: 400 }
      );
    }

    const result = await generateCertificate(userId, courseId);

    if (!result) {
      return NextResponse.json(
        { error: "Failed to generate certificate" },
        { status: 500 }
      );
    }

    return NextResponse.json(result);
  } catch (error) {
    const denied = toResponse(error);
    if (denied) return denied;

    logError("CERTIFICATE_POST", error);
    return new NextResponse("Internal Error", { status: 500 });
  }
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ courseId: string }> }
) {
  try {
    const { userId } = await requirePrincipal();

    const { courseId } = await params;

    const certificate = await db.certificate.findUnique({
      where: { userId_courseId: { userId, courseId } },
    });

    if (!certificate) {
      return NextResponse.json(null);
    }

    return NextResponse.json({
      certificateNumber: certificate.certificateNumber,
      pdfUrl: certificate.pdfUrl,
      issuedAt: certificate.issuedAt,
    });
  } catch (error) {
    const denied = toResponse(error);
    if (denied) return denied;

    logError("CERTIFICATE_GET", error);
    return new NextResponse("Internal Error", { status: 500 });
  }
}
