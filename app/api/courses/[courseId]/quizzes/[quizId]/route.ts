import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

import { db } from "@/lib/db";
import { isFaculty } from "@/lib/roles";
import { quizUpdateSchema } from "@/lib/validations/quiz";
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

    const body = await req.json();

    const parsed = quizUpdateSchema.safeParse(body);
    if (!parsed.success) {
      return new NextResponse("Invalid data", { status: 400 });
    }

    const quiz = await db.quiz.update({
      where: {
        id: routeParams.quizId,
        courseId: routeParams.courseId,
      },
      data: parsed.data,
    });

    return NextResponse.json(quiz);
  } catch (error) {
    logError("QUIZ_ID", error);
    return new NextResponse("Internal Error", { status: 500 });
  }
}

export async function DELETE(
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

    const quiz = await db.quiz.delete({
      where: {
        id: routeParams.quizId,
        courseId: routeParams.courseId,
      },
    });

    return NextResponse.json(quiz);
  } catch (error) {
    logError("QUIZ_ID_DELETE", error);
    return new NextResponse("Internal Error", { status: 500 });
  }
}
