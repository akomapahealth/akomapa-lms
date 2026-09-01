import { NextResponse } from "next/server";

import { db } from "@/lib/db";
import { authorizeQuizInCourse, requirePrincipal, toResponse } from "@/lib/auth";
import { logError } from "@/lib/logger";

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ courseId: string; quizId: string }> }
) {
  const routeParams = await params;

  try {
    const principal = await requirePrincipal();
    await authorizeQuizInCourse(
      principal,
      "question:reorder",
      routeParams.courseId,
      routeParams.quizId
    );

    const { list } = await req.json() as {
      list: { id: string; position: number }[];
    };

    for (const item of list) {
      await db.question.update({
        where: { id: item.id },
        data: { position: item.position },
      });
    }

    return new NextResponse("Success", { status: 200 });
  } catch (error) {
    const denied = toResponse(error);
    if (denied) return denied;

    logError("QUESTIONS_REORDER", error);
    return new NextResponse("Internal Error", { status: 500 });
  }
}
