import { db } from "@/lib/db";
import { authorizeTopicInCourse, requirePrincipal, toResponse } from "@/lib/auth";
import { NextResponse } from "next/server";
import { logError } from "@/lib/logger";

export async function PATCH(
    req: Request,
    { params }: { params: Promise<{ courseId: string; chapterId: string }> }
) {
        const routeParams = await params;

    try {
        const principal = await requirePrincipal();

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
            return new NextResponse("Missing required fields", { status: 400 });
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
        const denied = toResponse(error);
        if (denied) return denied;

        logError("CHAPTER_PUBLISH", error);
        return new NextResponse("Internal Error", { status: 500 });
    }
}