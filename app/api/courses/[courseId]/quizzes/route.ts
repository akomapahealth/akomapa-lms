import { NextResponse } from "next/server";

import { db } from "@/lib/db";
import { authorizeCourse, requirePrincipal, toResponse } from "@/lib/auth";
import { logError } from "@/lib/logger";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ courseId: string }> }
) {
  const routeParams = await params;

  try {
    const principal = await requirePrincipal();
    await authorizeCourse(principal, "quiz:create", routeParams.courseId);

    const { title, type, moduleId } = await req.json();

    if (!title || !type) {
      return new NextResponse("Missing required fields", { status: 400 });
    }

    const quiz = await db.quiz.create({
      data: {
        title,
        type,
        courseId: routeParams.courseId,
        moduleId: moduleId || null,
      },
    });

    return NextResponse.json(quiz);
  } catch (error) {
    const denied = toResponse(error);
    if (denied) return denied;

    logError("QUIZZES", error);
    return new NextResponse("Internal Error", { status: 500 });
  }
}
