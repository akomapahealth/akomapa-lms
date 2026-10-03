import { db } from "@/lib/db";
import { authorizeTopicInCourse, requirePrincipal } from "@/lib/auth";
import { NextResponse } from "next/server";
import { assertTrustedOrigin, handleRouteError, parseParams, problem } from "@/lib/http";
import { enforceRateLimit } from "@/lib/rate-limit";
import { topicParams } from "@/lib/validations/ids";

export async function PATCH(
    req: Request,
    { params }: { params: Promise<{ courseId: string; chapterId: string }> }
) {
    try {
        assertTrustedOrigin(req);

        const routeParams = parseParams(topicParams, await params);

        const principal = await requirePrincipal();
        await enforceRateLimit(req, "write.default", { userId: principal.userId });

        const topic = await authorizeTopicInCourse(
            principal,
            "topic:update",
            routeParams.courseId,
            routeParams.chapterId
        );

        const muxData = await db.muxData.findUnique({
            where: {
                topicId: routeParams.chapterId,
            }
        });

        if (!topic || !muxData || !topic.title || !topic.description || !topic.videoUrl) {
            // A state conflict rather than malformed input: nothing about the
            // request is wrong, the Topic is not ready to publish.
            return problem("conflict", {
                message:
                    "Add a title, description, and video before publishing this topic.",
            });
        }

        const publishedTopic = await db.topic.update({
            where: {
                id: routeParams.chapterId,
            },
            data: {
                isPublished: true,
            }
        });

        return NextResponse.json(publishedTopic);
    } catch (error) {
        return handleRouteError("CHAPTER_PUBLISH", error);
    }
}