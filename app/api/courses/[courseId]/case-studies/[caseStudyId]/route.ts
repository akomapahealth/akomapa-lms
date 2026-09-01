import type { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";

import { db } from "@/lib/db";
import { authorizeCaseStudyInCourse, requirePrincipal, toResponse } from "@/lib/auth";
import { caseStudyScenarioSchema } from "@/lib/case-study-types";
import { sanitizeScenario } from "@/lib/case-study-sanitize";
import { logError } from "@/lib/logger";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ courseId: string; caseStudyId: string }> }
) {
  try {
    const { courseId, caseStudyId } = await params;

    const principal = await requirePrincipal();
    await authorizeCaseStudyInCourse(principal, "caseStudy:update", courseId, caseStudyId);

    const values = await req.json();

    // Validate scenario if provided
    let sanitizedScenario: ReturnType<typeof sanitizeScenario> | null = null;
    if (values.scenario) {
      const parsed = caseStudyScenarioSchema.safeParse(values.scenario);
      if (parsed.success) {
        sanitizedScenario = sanitizeScenario(parsed.data);
      }
      if (!parsed.success) {
        return NextResponse.json(
          { error: "Invalid scenario structure", details: parsed.error.flatten() },
          { status: 400 }
        );
      }
    }

    const caseStudy = await db.caseStudy.update({
      where: { id: caseStudyId },
      data: {
        ...(values.title && { title: values.title }),
        ...(values.description !== undefined && { description: values.description }),
        // Sanitized, and taken from the parsed value rather than the body.
        ...(sanitizedScenario && {
          scenario: sanitizedScenario as unknown as Prisma.InputJsonValue,
        }),
      },
    });

    return NextResponse.json(caseStudy);
  } catch (error) {
    const denied = toResponse(error);
    if (denied) return denied;

    logError("CASE_STUDY_PATCH", error);
    return new NextResponse("Internal Error", { status: 500 });
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ courseId: string; caseStudyId: string }> }
) {
  try {
    const { courseId, caseStudyId } = await params;

    const principal = await requirePrincipal();
    await authorizeCaseStudyInCourse(principal, "caseStudy:delete", courseId, caseStudyId);

    await db.caseStudy.delete({ where: { id: caseStudyId } });

    return new NextResponse(null, { status: 204 });
  } catch (error) {
    const denied = toResponse(error);
    if (denied) return denied;

    logError("CASE_STUDY_DELETE", error);
    return new NextResponse("Internal Error", { status: 500 });
  }
}
