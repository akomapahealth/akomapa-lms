import { db } from "@/lib/db";
import { requirePrincipal } from "@/lib/auth";
import { NextResponse } from "next/server";
import { handleRouteError, parseParams, problem } from "@/lib/http";
import { courseParams } from "@/lib/validations/ids";

export async function PATCH(
    req: Request,
    { params }: { params: Promise<{ courseId: string }> }
) {
    try {
        const routeParams = parseParams(courseParams, await params);

        const { userId } = await requirePrincipal();

        const course = await db.course.findUnique({
            where: {
                id: routeParams.courseId,
                userId,
            },
        });

        if (!course) {
            return problem("not_found");
        }

        const publishedTopics = await db.topic.findMany({
            where: { module: { courseId: routeParams.courseId }, isPublished: true }
        });

        const hasPublishedChapter = publishedTopics.length > 0;

        if (!course.title || !course.description || !course.imageUrl || !course.categoryId || !hasPublishedChapter) {
            // Was 401, which made the web app redirect a signed-in author to the
            // sign-in page for an incomplete Course. It is a state conflict: the
            // Course is not publishable yet.
            return problem("conflict", {
                message:
                    "Add a title, description, image, category, and at least one published topic before publishing.",
            });
        }

        const publishedCourse = await db.course.update({
            where: {
                id: routeParams.courseId,
            },
            data: {
                isPublished: true,
            }
        });

        return NextResponse.json(publishedCourse);
    } catch (error) {
        return handleRouteError("COURSE_ID_PUBLISH", error);
    }
}