import { NextResponse } from "next/server";

import { db } from "@/lib/db";
import { authorizeQuestionInCourse, requirePrincipal } from "@/lib/auth";
import { assertTrustedOrigin, handleRouteError, parseBody, parseParams, problem } from "@/lib/http";
import { TEMPORARY_POSITION_BASE } from "@/lib/courses/ordering";
import { hasLearnerRecords, LEARNER_RECORDS_CONFLICT } from "@/lib/courses/learner-records";
import { enforceRateLimit } from "@/lib/rate-limit";
import { questionParams } from "@/lib/validations/ids";
import { questionUpdateSchema } from "@/lib/validations/quiz";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ courseId: string; quizId: string; questionId: string }> }
) {
  try {
    assertTrustedOrigin(req);

    const routeParams = parseParams(questionParams, await params);

    const principal = await requirePrincipal();
    await enforceRateLimit(req, "write.default", { userId: principal.userId });
    await authorizeQuestionInCourse(
      principal,
      "question:update",
      routeParams.courseId,
      routeParams.quizId,
      routeParams.questionId
    );

    // The body was cast with `as`, which is a claim rather than a check: `points`
    // could be a string, `options` could be thousands of entries, and each
    // option's `text` was unbounded.
    const body = await parseBody(questionUpdateSchema, req);

    const existingOptions = await db.questionOption.findMany({
      where: { questionId: routeParams.questionId },
      select: { id: true },
    });
    const existingIds = new Set(existingOptions.map((o) => o.id));

    // Every supplied option id must already belong to *this* question. The
    // previous version passed them straight to `update` matched on id alone, so
    // an author could rewrite the text of -- or flip `isCorrect` on -- an option
    // belonging to any other question in the product, including one in a Course
    // they do not own. A uuid from elsewhere is still a valid uuid.
    const foreign = (body.options ?? []).filter(
      (option) => option.id !== undefined && !existingIds.has(option.id)
    );
    if (foreign.length > 0) {
      return problem("not_found");
    }

    // One transaction. A failure partway through used to leave a question whose
    // options had been deleted but not recreated, which is an unanswerable
    // question on a published quiz.
    const incomingIds = new Set(
      (body.options ?? []).flatMap((o) => (o.id === undefined ? [] : [o.id]))
    );
    const toDelete = body.options
      ? [...existingIds].filter((id) => !incomingIds.has(id))
      : [];

    // Removing an option a learner chose would rewrite their graded answer
    // (#51). Refused before anything changes; RESTRICT on QuizAnswer backs this
    // up if an answer lands between this check and the delete.
    if (await hasLearnerRecords({ kind: "options", optionIds: toDelete })) {
      return problem("conflict", { message: LEARNER_RECORDS_CONFLICT.options });
    }

    const updated = await db.$transaction(async (tx) => {
      await tx.question.update({
        where: { id: routeParams.questionId },
        data: {
          ...(body.text !== undefined && { text: body.text }),
          ...(body.points !== undefined && { points: body.points }),
        },
      });

      if (body.options) {
        if (toDelete.length > 0) {
          // Scoped to the question as well as the ids, so the delete cannot
          // reach further than the question being edited even if `existingIds`
          // were ever computed from something wider.
          await tx.questionOption.deleteMany({
            where: { id: { in: toDelete }, questionId: routeParams.questionId },
          });
        }

        // Options are unique per question and position (#51). Park the
        // surviving options at temporary positions first, so swapping two
        // options' positions never collides mid-transaction.
        const surviving = body.options.flatMap((o) => (o.id === undefined ? [] : [o.id]));
        for (const [index, id] of surviving.entries()) {
          await tx.questionOption.update({
            where: { id, questionId: routeParams.questionId },
            data: { position: TEMPORARY_POSITION_BASE + index },
          });
        }

        for (const option of body.options) {
          if (option.id !== undefined) {
            await tx.questionOption.update({
              where: { id: option.id, questionId: routeParams.questionId },
              data: {
                text: option.text,
                isCorrect: option.isCorrect,
                position: option.position,
              },
            });
          } else {
            await tx.questionOption.create({
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

      return tx.question.findUnique({
        where: { id: routeParams.questionId },
        include: {
          options: { orderBy: { position: "asc" } },
        },
      });
    });

    return NextResponse.json(updated);
  } catch (error) {
    return handleRouteError("QUESTION_ID", error);
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ courseId: string; quizId: string; questionId: string }> }
) {
  try {
    assertTrustedOrigin(req);

    const routeParams = parseParams(questionParams, await params);

    const principal = await requirePrincipal();
    await enforceRateLimit(req, "write.default", { userId: principal.userId });
    await authorizeQuestionInCourse(
      principal,
      "question:delete",
      routeParams.courseId,
      routeParams.quizId,
      routeParams.questionId
    );

    // Deleting an answered question would silently change learners' grades
    // (#51). RESTRICT on QuizAnswer backs this up under a race.
    if (await hasLearnerRecords({ kind: "question", questionId: routeParams.questionId })) {
      return problem("conflict", { message: LEARNER_RECORDS_CONFLICT.question });
    }

    const question = await db.question.delete({
      where: { id: routeParams.questionId },
    });

    return NextResponse.json(question);
  } catch (error) {
    return handleRouteError("QUESTION_ID_DELETE", error);
  }
}
