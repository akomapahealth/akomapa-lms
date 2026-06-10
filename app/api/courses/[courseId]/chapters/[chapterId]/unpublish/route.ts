import { db } from "@/lib/db";
import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

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
        console.log("[CHAPTER_UNPUBLISH]", error);
        return new NextResponse("Internal Error", { status: 500 });
    }
}