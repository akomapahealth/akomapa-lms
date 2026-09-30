import { NextResponse } from "next/server";

import { db } from "@/lib/db";
import { requirePrincipal } from "@/lib/auth";
import { handleRouteError, parseBody, parseParams, problem } from "@/lib/http";
import { caseStudyAttemptParams } from "@/lib/validations/ids";
import { caseStudyAttemptSchema } from "@/lib/validations/case-study";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ courseId: string; caseStudyId: string }> }
) {
  try {
    const { courseId, caseStudyId } = parseParams(
      caseStudyAttemptParams,
      await params
    );

    const { userId } = await requirePrincipal();

    // `choices` was an unvalidated JSON blob of any shape and any size, written
    // straight to a `Json` column.
    const body = await parseBody(caseStudyAttemptSchema, req);

    // The case study must be in the Course named in the URL. The handler read
    // only `caseStudyId`, so the `[courseId]` segment was decorative and an
    // attempt could be recorded against a case study in any Course.
    const caseStudy = await db.caseStudy.findFirst({
      where: { id: caseStudyId, topic: { module: { courseId } } },
      select: { id: true },
    });

    if (!caseStudy) {
      return problem("not_found");
    }

    const attempt = await db.caseStudyAttempt.create({
      data: {
        userId,
        caseStudyId,
        choices: body.choices,
        completed: body.completed ?? false,
      },
    });

    return NextResponse.json(attempt);
  } catch (error) {
    return handleRouteError("CASE_STUDY_ATTEMPT", error);
  }
}
