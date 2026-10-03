import Mux from "@mux/mux-node";
import { NextResponse } from "next/server";

import { db } from "@/lib/db";
import { authorizeCourse, requirePrincipal } from "@/lib/auth";
import { assertTrustedOrigin, handleRouteError, parseBody, parseParams, problem } from "@/lib/http";
import { courseParams } from "@/lib/validations/ids";
import { courseUpdateSchema } from "@/lib/validations/course";

const mux = new Mux({
    tokenId: process.env.MUX_TOKEN_ID,
    tokenSecret: process.env.MUX_TOKEN_SECRET,
});

const Video  = mux.video;

export async function DELETE(
    req: Request,
    { params }: { params: Promise<{ courseId: string }> }
) {
    try {
        assertTrustedOrigin(req);

        const routeParams = parseParams(courseParams, await params);

        const principal = await requirePrincipal();
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

        for (const courseModule of course.modules) {
            for (const topic of courseModule.topics) {
                if (topic.muxData?.assetId) {
                    await Video.assets.delete(topic.muxData.assetId);
                }
            }
        }

        const deletedCourse = await db.course.delete({
            where: {
                id: routeParams.courseId,
            },
        });

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