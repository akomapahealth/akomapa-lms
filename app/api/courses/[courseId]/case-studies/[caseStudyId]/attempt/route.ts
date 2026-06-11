import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

import { db } from "@/lib/db";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ caseStudyId: string }> }
) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

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
    console.log("[CASE_STUDY_ATTEMPT]", error);
    return new NextResponse("Internal Error", { status: 500 });
  }
}
