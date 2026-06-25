import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

import { db } from "@/lib/db";
import { isFaculty } from "@/lib/roles";
import { logError } from "@/lib/logger";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ courseId: string }> }
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
    logError("QUIZZES", error);
    return new NextResponse("Internal Error", { status: 500 });
  }
}
