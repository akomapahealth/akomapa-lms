import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

import { db } from "@/lib/db";
import { isFaculty } from "@/lib/roles";
import { logError } from "@/lib/logger";

export async function POST(
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

    const { text } = await req.json();

    if (!text) {
      return new NextResponse("Question text is required", { status: 400 });
    }

    const lastQuestion = await db.question.findFirst({
      where: { quizId: routeParams.quizId },
      orderBy: { position: "desc" },
    });

    const newPosition = lastQuestion ? lastQuestion.position + 1 : 1;

    const question = await db.question.create({
      data: {
        text,
        quizId: routeParams.quizId,
        position: newPosition,
      },
    });

    return NextResponse.json(question);
  } catch (error) {
    logError("QUESTIONS", error);
    return new NextResponse("Internal Error", { status: 500 });
  }
}
