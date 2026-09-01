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
        await authorizeTopicInCourse(principal, "topic:update", routeParams.courseId, routeParams.chapterId);
        const userId = principal.userId;

        const unpublishedTopic = await db.topic.update({
            where: {
                id: routeParams.chapterId,
            },
            data: {
                isPublished: false,
            }
        });

        const publishedTopicsInCourse = await db.topic.findMany({
            where: {
                module: { courseId: routeParams.courseId },
                isPublished: true,
            }
        });

        if (!publishedTopicsInCourse.length) {
            await db.course.update({
                where: {
                    id: routeParams.courseId,
                },
                data: {
                    isPublished: false,
                }
            });
        }

        return NextResponse.json(unpublishedTopic);
    } catch (error) {
        const denied = toResponse(error);
        if (denied) return denied;

        logError("CHAPTER_UNPUBLISH", error);
        return new NextResponse("Internal Error", { status: 500 });
    }
}