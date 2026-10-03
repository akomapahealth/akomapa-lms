import { NextResponse } from "next/server";

import { db } from "@/lib/db";
import { authorizeQuizInCourse, requirePrincipal } from "@/lib/auth";
import { assertTrustedOrigin, BODY_BYTES, handleRouteError, parseBody, parseParams, problem } from "@/lib/http";
import { quizParams } from "@/lib/validations/ids";
import { reorderSchema } from "@/lib/validations/reorder";

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ courseId: string; quizId: string }> }
) {
  try {
    assertTrustedOrigin(req);

    const routeParams = parseParams(quizParams, await params);

    const principal = await requirePrincipal();
    await authorizeQuizInCourse(
      principal,
      "question:reorder",
      routeParams.courseId,
      routeParams.quizId
    );

    const { list } = await parseBody(reorderSchema, req, BODY_BYTES.reorder);

    // Every id must be a Question on *this* Quiz. Authorization covered the Quiz
    // in the URL, not the ids in the body, and the update matched on `id` alone.
    const ids = list.map((item) => item.id);
    const owned = await db.question.findMany({
      where: { id: { in: ids }, quizId: routeParams.quizId },
      select: { id: true },
    });

    if (owned.length !== ids.length) {
      return problem("not_found");
    }

    // One transaction: a partial reorder leaves two questions sharing a position.
    await db.$transaction(
      list.map((item) =>
        db.question.update({
          where: { id: item.id },
          data: { position: item.position },
        })
      )
    );

    return new NextResponse(null, { status: 204 });
  } catch (error) {
    return handleRouteError("QUESTIONS_REORDER", error);
  }
}
