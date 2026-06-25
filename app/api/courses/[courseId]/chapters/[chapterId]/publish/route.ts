import { db } from "@/lib/db";
import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { logError } from "@/lib/logger";

export async function PATCH(
    req: Request,
    { params }: { params: Promise<{ courseId: string; chapterId: string }> }
) {
        const routeParams = await params;

    try {
        const { userId } = await auth();

        if (!userId) {
            return new NextResponse("Unauthorized", { status: 401 });
        }

        const ownCourse = await db.course.findUnique({
            where: {
                id: routeParams.courseId,
                userId,
            }
        });

        if (!ownCourse) {
            return new NextResponse("Unauthorized", { status: 401 });
        }

        const topic = await db.topic.findUnique({
            where: {
                id: routeParams.chapterId,
            }
        });

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
        logError("CHAPTER_PUBLISH", error);
        return new NextResponse("Internal Error", { status: 500 });
    }
}