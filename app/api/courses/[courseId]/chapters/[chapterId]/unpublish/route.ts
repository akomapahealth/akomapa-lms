import { db } from "@/lib/db";
import { authorizeTopicInCourse, requirePrincipal } from "@/lib/auth";
import { NextResponse } from "next/server";
import { handleRouteError, parseParams } from "@/lib/http";
import { topicParams } from "@/lib/validations/ids";

export async function PATCH(
    req: Request,
    { params }: { params: Promise<{ courseId: string; chapterId: string }> }
) {
    try {
        const routeParams = parseParams(topicParams, await params);

        const principal = await requirePrincipal();
        await authorizeTopicInCourse(principal, "topic:update", routeParams.courseId, routeParams.chapterId);

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
        return handleRouteError("CHAPTER_UNPUBLISH", error);
    }
}