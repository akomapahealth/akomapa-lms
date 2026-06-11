import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

import { db } from "@/lib/db";
import { generateCertificate } from "@/lib/certificate-service";

export const maxDuration = 30;

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ courseId: string }> }
) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

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
    console.log("[CERTIFICATE_POST]", error);
    return new NextResponse("Internal Error", { status: 500 });
  }
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ courseId: string }> }
) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

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
    console.log("[CERTIFICATE_GET]", error);
    return new NextResponse("Internal Error", { status: 500 });
  }
}
