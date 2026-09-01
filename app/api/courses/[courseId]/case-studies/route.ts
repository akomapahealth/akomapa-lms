import type { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";

import { db } from "@/lib/db";
import { authorizeCourse, requirePrincipal, toResponse } from "@/lib/auth";
import { caseStudyScenarioSchema } from "@/lib/case-study-types";
import { sanitizeScenario } from "@/lib/case-study-sanitize";
import { logError } from "@/lib/logger";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ courseId: string }> }
) {
  try {
    const { courseId } = await params;

    const principal = await requirePrincipal();
    await authorizeCourse(principal, "caseStudy:create", courseId);
    const { topicId, title, description, scenario } = await req.json();

    if (!topicId || !title || !scenario) {
      return new NextResponse("Missing required fields", { status: 400 });
    }

    // Validate scenario structure
    const parsed = caseStudyScenarioSchema.safeParse(scenario);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid scenario structure", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    // Verify topic belongs to this course
    const topic = await db.topic.findFirst({
      where: {
        id: topicId,
        module: { courseId },
      },
    });

    if (!topic) {
      return new NextResponse("Topic not found in this course", {
        status: 404,
      });
    }

    const caseStudy = await db.caseStudy.create({
      data: {
        topicId,
        title,
        description: description || "",
        // The parsed value, sanitized: storing the raw body kept unknown
        // fields, and storing unsanitized rich text is what made the player a
        // stored-XSS vector. Reads sanitize as well, since rows written before
        // this are still untrusted.
        scenario: sanitizeScenario(parsed.data) as unknown as Prisma.InputJsonValue,
      },
    });

    return NextResponse.json(caseStudy);
  } catch (error) {
    const denied = toResponse(error);
    if (denied) return denied;

    logError("CASE_STUDY_CREATE", error);
    return new NextResponse("Internal Error", { status: 500 });
  }
}
