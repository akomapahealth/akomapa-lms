import type { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";

import { db } from "@/lib/db";
import { authorizeCourse, requirePrincipal } from "@/lib/auth";
import { sanitizeScenario } from "@/lib/case-study-sanitize";
import { assertTrustedOrigin, BODY_BYTES, handleRouteError, parseBody, parseParams, problem } from "@/lib/http";
import { courseParams } from "@/lib/validations/ids";
import { caseStudyCreateSchema } from "@/lib/validations/case-study";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ courseId: string }> }
) {
  try {
    assertTrustedOrigin(req);

    const { courseId } = parseParams(courseParams, await params);

    const principal = await requirePrincipal();
    await authorizeCourse(principal, "caseStudy:create", courseId);

    // Envelope and scenario in one schema. The envelope was previously read off
    // the raw body -- `topicId` any string, `description` any size -- while only
    // the scenario was validated. A structured document, so the largest ceiling.
    const body = await parseBody(caseStudyCreateSchema, req, BODY_BYTES.document);

    // The Topic must be in this Course.
    const topic = await db.topic.findFirst({
      where: {
        id: body.topicId,
        module: { courseId },
      },
      select: { id: true },
    });

    if (!topic) {
      return problem("not_found");
    }

    const caseStudy = await db.caseStudy.create({
      data: {
        topicId: body.topicId,
        title: body.title,
        description: body.description ?? "",
        // The parsed value, sanitized: storing the raw body kept unknown
        // fields, and storing unsanitized rich text is what made the player a
        // stored-XSS vector. Reads sanitize as well, since rows written before
        // this are still untrusted.
        scenario: sanitizeScenario(body.scenario) as unknown as Prisma.InputJsonValue,
      },
    });

    return NextResponse.json(caseStudy);
  } catch (error) {
    return handleRouteError("CASE_STUDY_CREATE", error);
  }
}
