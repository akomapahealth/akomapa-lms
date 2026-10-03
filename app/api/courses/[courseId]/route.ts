import { NextResponse } from "next/server";

import { db } from "@/lib/db";
import { authorizeCourse, requirePrincipal } from "@/lib/auth";
import { assertTrustedOrigin, handleRouteError, parseBody, parseParams, problem } from "@/lib/http";
import { enforceRateLimit } from "@/lib/rate-limit";
import { courseParams } from "@/lib/validations/ids";
import { hasLearnerRecords, LEARNER_RECORDS_CONFLICT } from "@/lib/courses/learner-records";
import { deleteMuxAssets } from "@/lib/courses/mux-cleanup";
import { courseUpdateSchema } from "@/lib/validations/course";

export async function DELETE(
    req: Request,
    { params }: { params: Promise<{ courseId: string }> }
) {
    try {
        assertTrustedOrigin(req);

        const routeParams = parseParams(courseParams, await params);

        const principal = await requirePrincipal();
        await enforceRateLimit(req, "write.default", { userId: principal.userId });
        await authorizeCourse(principal, "course:delete", routeParams.courseId);

        const course = await db.course.findUnique({
            where: {
                id: routeParams.courseId,
                userId: principal.userId,
            },
            include: {
                modules: {
                    include: {
                        topics: {
                            include: {
                                muxData: true,
                            }
                        }
                    }
                }
            }
        });

        if (!course) {
            return problem("not_found");
        }

        // Payments, enrollments, certificates, progress, and attempts outlive
        // the Course (#51, policy 02). Checked before anything is touched: the
        // Mux assets used to be deleted first, so a refused delete left a live
        // Course with broken videos.
        if (await hasLearnerRecords({ kind: "course", courseId: routeParams.courseId })) {
            return problem("conflict", { message: LEARNER_RECORDS_CONFLICT.course });
        }

        const assetIds = course.modules.flatMap((courseModule) =>
            courseModule.topics.flatMap((topic) =>
                topic.muxData?.assetId ? [topic.muxData.assetId] : []
            )
        );

        // The database first. If a learner enrolled between the check and
        // here, RESTRICT refuses this and nothing external has been deleted.
        const deletedCourse = await db.course.delete({
            where: {
                id: routeParams.courseId,
            },
        });

        await deleteMuxAssets(assetIds, "COURSE_ID_DELETE");

        return NextResponse.json(deletedCourse);
    } catch (error) {
        return handleRouteError("COURSE_ID_DELETE", error);
    }
}

export async function PATCH(
    req: Request,
    { params }: { params: Promise<{ courseId: string }> }
) {
    try {
        assertTrustedOrigin(req);

        const { courseId } = parseParams(courseParams, await params);

        const principal = await requirePrincipal();
        await enforceRateLimit(req, "write.default", { userId: principal.userId });
        await authorizeCourse(principal, "course:update", courseId);

        const values = await parseBody(courseUpdateSchema, req);

        const course = await db.course.update({
            where: {
                id: courseId,
                userId: principal.userId
            },
            data: values,
        });

        return NextResponse.json(course);
    } catch (error) {
        return handleRouteError("COURSE_ID", error);
    }
}