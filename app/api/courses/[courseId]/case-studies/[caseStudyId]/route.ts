import type { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";

import { db } from "@/lib/db";
import { authorizeCaseStudyInCourse, requirePrincipal } from "@/lib/auth";
import { sanitizeScenario } from "@/lib/case-study-sanitize";
import { assertTrustedOrigin, BODY_BYTES, handleRouteError, parseBody, parseParams } from "@/lib/http";
import { caseStudyParams } from "@/lib/validations/ids";
import { caseStudyUpdateSchema } from "@/lib/validations/case-study";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ courseId: string; caseStudyId: string }> }
) {
  try {
    assertTrustedOrigin(req);

    const { courseId, caseStudyId } = parseParams(caseStudyParams, await params);

    const principal = await requirePrincipal();
    await authorizeCaseStudyInCourse(principal, "caseStudy:update", courseId, caseStudyId);

    const body = await parseBody(caseStudyUpdateSchema, req, BODY_BYTES.document);

    const caseStudy = await db.caseStudy.update({
      where: { id: caseStudyId },
      data: {
        ...(body.title !== undefined && { title: body.title }),
        ...(body.description !== undefined && { description: body.description }),
        // Sanitized, and taken from the parsed value rather than the body.
        ...(body.scenario !== undefined && {
          scenario: sanitizeScenario(body.scenario) as unknown as Prisma.InputJsonValue,
        }),
      },
    });

    return NextResponse.json(caseStudy);
  } catch (error) {
    return handleRouteError("CASE_STUDY_PATCH", error);
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ courseId: string; caseStudyId: string }> }
) {
  try {
    assertTrustedOrigin(req);

    const { courseId, caseStudyId } = parseParams(caseStudyParams, await params);

    const principal = await requirePrincipal();
    await authorizeCaseStudyInCourse(principal, "caseStudy:delete", courseId, caseStudyId);

    await db.caseStudy.delete({ where: { id: caseStudyId } });

    return new NextResponse(null, { status: 204 });
  } catch (error) {
    return handleRouteError("CASE_STUDY_DELETE", error);
  }
}
