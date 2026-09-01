import { NextResponse } from "next/server";

import { db } from "@/lib/db";
import { authorizeQuestionInCourse, requirePrincipal, toResponse } from "@/lib/auth";
import { logError } from "@/lib/logger";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ courseId: string; quizId: string; questionId: string }> }
) {
  const routeParams = await params;

  try {
    const principal = await requirePrincipal();
    await authorizeQuestionInCourse(
      principal,
      "question:update",
      routeParams.courseId,
      routeParams.quizId,
      routeParams.questionId
    );

    const { text, points, options } = await req.json() as {
      text?: string;
      points?: number;
      options?: { id?: string; text: string; isCorrect: boolean; position: number }[];
    };

    // Update question fields
    await db.question.update({
      where: { id: routeParams.questionId },
      data: {
        ...(text !== undefined && { text }),
        ...(points !== undefined && { points }),
      },
    });

    // Update options if provided
    if (options) {
      // Get existing option IDs
      const existingOptions = await db.questionOption.findMany({
        where: { questionId: routeParams.questionId },
        select: { id: true },
      });

      const incomingIds = options.filter((o) => o.id).map((o) => o.id!);
      const toDelete = existingOptions.filter((o) => !incomingIds.includes(o.id));

      // Delete removed options
      if (toDelete.length > 0) {
        await db.questionOption.deleteMany({
          where: { id: { in: toDelete.map((o) => o.id) } },
        });
      }

      // Upsert options
      for (const option of options) {
        if (option.id) {
          await db.questionOption.update({
            where: { id: option.id },
            data: {
              text: option.text,
              isCorrect: option.isCorrect,
              position: option.position,
            },
          });
        } else {
          await db.questionOption.create({
            data: {
              text: option.text,
              isCorrect: option.isCorrect,
              position: option.position,
              questionId: routeParams.questionId,
            },
          });
        }
      }
    }

    const updated = await db.question.findUnique({
      where: { id: routeParams.questionId },
      include: {
        options: { orderBy: { position: "asc" } },
      },
    });

    return NextResponse.json(updated);
  } catch (error) {
    const denied = toResponse(error);
    if (denied) return denied;

    logError("QUESTION_ID", error);
    return new NextResponse("Internal Error", { status: 500 });
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ courseId: string; quizId: string; questionId: string }> }
) {
  const routeParams = await params;

  try {
    const principal = await requirePrincipal();
    await authorizeQuestionInCourse(
      principal,
      "question:delete",
      routeParams.courseId,
      routeParams.quizId,
      routeParams.questionId
    );

    const question = await db.question.delete({
      where: { id: routeParams.questionId },
    });

    return NextResponse.json(question);
  } catch (error) {
    const denied = toResponse(error);
    if (denied) return denied;

    logError("QUESTION_ID_DELETE", error);
    return new NextResponse("Internal Error", { status: 500 });
  }
}
