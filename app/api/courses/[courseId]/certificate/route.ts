import { NextResponse } from "next/server";

import { db } from "@/lib/db";
import { requirePrincipal } from "@/lib/auth";
import { generateCertificate } from "@/lib/certificate-service";
import { enrollmentStatusFor } from "@/lib/entitlement";
import { assertTrustedOrigin, handleRouteError, parseParams, problem } from "@/lib/http";
import { courseParams } from "@/lib/validations/ids";

export const maxDuration = 30;

export async function POST(
  req: Request,
  { params }: { params: Promise<{ courseId: string }> }
) {
  try {
    assertTrustedOrigin(req);

    const { userId } = await requirePrincipal();

    const { courseId } = parseParams(courseParams, await params);

    // Through the entitlement module, which normalizes the status so an
    // unrecognised value cannot read as completion (ADR 0002).
    if ((await enrollmentStatusFor(userId, courseId)) !== "COMPLETED") {
      return problem("conflict", {
        message: "Finish the course before requesting a certificate.",
      });
    }

    const result = await generateCertificate(userId, courseId);

    if (!result) {
      // The service returning nothing is a fault, not a client error, and it
      // answers in the same shape as any other fault.
      return problem("internal");
    }

    return NextResponse.json(result);
  } catch (error) {
    return handleRouteError("CERTIFICATE_POST", error);
  }
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ courseId: string }> }
) {
  try {
    const { userId } = await requirePrincipal();

    const { courseId } = parseParams(courseParams, await params);

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
    return handleRouteError("CERTIFICATE_GET", error);
  }
}
