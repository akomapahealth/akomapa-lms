import { NextResponse } from "next/server";

import { requirePrincipal } from "@/lib/auth";
import { setTopicCompletion } from "@/lib/courses/complete-topic";
import { assertTrustedOrigin, handleRouteError, parseBody, parseParams, problem } from "@/lib/http";
import { enforceRateLimit } from "@/lib/rate-limit";
import { topicParams } from "@/lib/validations/ids";
import { progressSchema } from "@/lib/validations/topic";

/**
 * Marks a Topic complete or incomplete for the signed-in learner.
 *
 * A thin boundary over the completion command (#49, ADR 0004): the progress
 * write, Module and Course completion, the Enrollment transition, streak,
 * badges, the Certificate row, and their domain events all commit in one
 * transaction inside `setTopicCompletion`. This handler validates the request
 * and shapes the response, which keeps the fields the Topic player reads.
 */
export async function PUT(
    req: Request,
    { params }: { params: Promise<{ courseId: string; chapterId: string }> }
) {
    try {
        assertTrustedOrigin(req);

        const routeParams = parseParams(topicParams, await params);

        const principal = await requirePrincipal();
        await enforceRateLimit(req, "write.default", { userId: principal.userId });

        // Before any query: an unparseable body should cost nothing.
        const { isCompleted } = await parseBody(progressSchema, req);

        const outcome = await setTopicCompletion(
            principal,
            routeParams.courseId,
            routeParams.chapterId,
            isCompleted
        );

        if (outcome.kind === "not_found") {
            return problem("not_found");
        }

        return NextResponse.json({
            ...outcome.progress,
            isModuleComplete: outcome.completedModule !== null,
            moduleName: outcome.completedModule?.title ?? "",
            isCourseComplete: outcome.courseCompleted,
            certificateNumber: outcome.certificate?.certificateNumber ?? null,
            awardedBadges: outcome.awardedBadges.map((b) => ({
                id: b.id,
                name: b.name,
                description: b.description,
                type: b.type,
            })),
        });
    } catch (error) {
        return handleRouteError("CHAPTER_ID_PROGRESS", error);
    }
}
