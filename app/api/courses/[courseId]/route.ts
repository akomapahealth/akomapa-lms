import Mux from "@mux/mux-node";
import { NextResponse } from "next/server";

import { db } from "@/lib/db";
import { authorizeCourse, requirePrincipal, toResponse } from "@/lib/auth";
import { courseUpdateSchema } from "@/lib/validations/course";
import { logError } from "@/lib/logger";

const mux = new Mux({
    tokenId: process.env.MUX_TOKEN_ID,
    tokenSecret: process.env.MUX_TOKEN_SECRET,
});

const Video  = mux.video;

export async function DELETE(
    req: Request,
    { params }: { params: Promise<{ courseId: string }> }
) {
        const routeParams = await params;

    try {
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
            return new NextResponse("Course not found", { status: 404 });
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
        const denied = toResponse(error);
        if (denied) return denied;

        logError("COURSE_ID_DELETE", error);
        return new NextResponse("Internal Error", { status: 500 });
    }
}

export async function PATCH(
    req: Request,
    { params }: { params: Promise<{ courseId: string }> }
) {
    try {
        const { courseId } = await params;

        const principal = await requirePrincipal();
        await authorizeCourse(principal, "course:update", courseId);

        const body = await req.json();
        const parsed = courseUpdateSchema.safeParse(body);
        if (!parsed.success) {
            return new NextResponse("Invalid data", { status: 400 });
        }

        const course = await db.course.update({
            where: {
                id: courseId,
                userId: principal.userId
            },
            data: parsed.data,
        });

        return NextResponse.json(course);
    } catch (error) {
        const denied = toResponse(error);
        if (denied) return denied;

        logError("COURSE_ID", error);
        return new NextResponse("Internal Error", { status: 500 });
    }
}