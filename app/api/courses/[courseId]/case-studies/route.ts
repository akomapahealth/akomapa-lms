import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

import { db } from "@/lib/db";
import { isAdmin } from "@/lib/roles";
import { caseStudyScenarioSchema } from "@/lib/case-study-types";
import { logError } from "@/lib/logger";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ courseId: string }> }
) {
  try {
    const { userId } = await auth();
    if (!userId || !(await isAdmin(userId))) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    const { courseId } = await params;
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
        scenario,
      },
    });

    return NextResponse.json(caseStudy);
  } catch (error) {
    logError("CASE_STUDY_CREATE", error);
    return new NextResponse("Internal Error", { status: 500 });
  }
}
