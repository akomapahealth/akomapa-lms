import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

import { db } from "@/lib/db";
import { isFaculty } from "@/lib/roles";
import { logError } from "@/lib/logger";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ courseId: string; quizId: string }> }
) {
  const routeParams = await params;

  try {
    const { userId } = await auth();

    if (!userId) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    const faculty = await isFaculty(userId);
    if (!faculty) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    const updated = await db.quiz.update({
      where: {
        id: routeParams.quizId,
        courseId: routeParams.courseId,
      },
      data: { isPublished: false },
    });

    return NextResponse.json(updated);
  } catch (error) {
    logError("QUIZ_UNPUBLISH", error);
    return new NextResponse("Internal Error", { status: 500 });
  }
}
