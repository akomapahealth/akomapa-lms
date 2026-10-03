import { db } from "@/lib/db";
import { requirePrincipal } from "@/lib/auth";
import { NextResponse } from "next/server";
import { assertTrustedOrigin, handleRouteError, parseParams, problem } from "@/lib/http";
import { courseParams } from "@/lib/validations/ids";

export async function PATCH(
    req: Request,
    { params }: { params: Promise<{ courseId: string }> }
) {
    try {
        assertTrustedOrigin(req);

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
        return handleRouteError("COURSE_ID_UNPUBLISH", error);
    }
}