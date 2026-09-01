import { db } from "@/lib/db";
import { requirePrincipal, toResponse } from "@/lib/auth";
import { NextResponse } from "next/server";
import { logError } from "@/lib/logger";

export async function PATCH(
    req: Request,
    { params }: { params: Promise<{ courseId: string }> }
) {
        const routeParams = await params;

    try {
        const { userId } = await requirePrincipal();

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
        const denied = toResponse(error);
        if (denied) return denied;

        logError("COURSE_ID_UNPUBLISH", error);
        return new NextResponse("Internal Error", { status: 500 });
    }
}