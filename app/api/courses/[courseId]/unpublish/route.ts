import { db } from "@/lib/db";
import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { logError } from "@/lib/logger";

export async function PATCH(
    req: Request,
    { params }: { params: Promise<{ courseId: string }> }
) {
        const routeParams = await params;

    try {
        const { userId } = await auth();

        if (!userId) {
            return new NextResponse("Unauthorized", { status: 401 });
        }

        const course = await db.course.findUnique({
            where: {
                id: routeParams.courseId,
                userId,
            },
        });

        if (!course) {
            return new NextResponse("Course not found", { status: 404 });
        }

        const unpublishedCourse = await db.course.update({
            where: {
                id: routeParams.courseId,
            },
            data: {
                isPublished: false,
            }
        });

        return NextResponse.json(unpublishedCourse);
    } catch (error) {
        logError("COURSE_ID_UNPUBLISH", error);
        return new NextResponse("Internal Error", { status: 500 });
    }
}