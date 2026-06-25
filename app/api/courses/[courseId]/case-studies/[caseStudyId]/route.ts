import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

import { db } from "@/lib/db";
import { isAdmin } from "@/lib/roles";
import { caseStudyScenarioSchema } from "@/lib/case-study-types";
import { logError } from "@/lib/logger";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ caseStudyId: string }> }
) {
  try {
    const { userId } = await auth();
    if (!userId || !(await isAdmin(userId))) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    const { caseStudyId } = await params;
    const values = await req.json();

    // Validate scenario if provided
    if (values.scenario) {
      const parsed = caseStudyScenarioSchema.safeParse(values.scenario);
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
        ...(values.scenario && { scenario: values.scenario }),
      },
    });

    return NextResponse.json(caseStudy);
  } catch (error) {
    logError("CASE_STUDY_PATCH", error);
    return new NextResponse("Internal Error", { status: 500 });
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ caseStudyId: string }> }
) {
  try {
    const { userId } = await auth();
    if (!userId || !(await isAdmin(userId))) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    const { caseStudyId } = await params;

    await db.caseStudy.delete({ where: { id: caseStudyId } });

    return new NextResponse(null, { status: 204 });
  } catch (error) {
    logError("CASE_STUDY_DELETE", error);
    return new NextResponse("Internal Error", { status: 500 });
  }
}
