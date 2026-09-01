import { NextResponse } from "next/server";

import { db } from "@/lib/db";
import { requirePrincipal, toResponse } from "@/lib/auth";
import { logError } from "@/lib/logger";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ caseStudyId: string }> }
) {
  try {
    const { userId } = await requirePrincipal();

    const { caseStudyId } = await params;
    const { choices, completed } = await req.json();

    const attempt = await db.caseStudyAttempt.create({
      data: {
        userId,
        caseStudyId,
        choices,
        completed: completed ?? false,
      },
    });

    return NextResponse.json(attempt);
  } catch (error) {
    const denied = toResponse(error);
    if (denied) return denied;

    logError("CASE_STUDY_ATTEMPT", error);
    return new NextResponse("Internal Error", { status: 500 });
  }
}
