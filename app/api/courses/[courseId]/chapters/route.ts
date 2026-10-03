import { NextResponse } from "next/server";

import { db } from "@/lib/db";
import { authorizeCourse, requirePrincipal } from "@/lib/auth";
import { assertTrustedOrigin, handleRouteError, parseBody, parseParams } from "@/lib/http";
import { enforceRateLimit } from "@/lib/rate-limit";
import { courseParams } from "@/lib/validations/ids";
import { topicCreateSchema } from "@/lib/validations/topic";

export async function POST(
    req: Request,
    { params }: { params: Promise<{ courseId: string }> }
) {
    try {
        assertTrustedOrigin(req);

        const routeParams = parseParams(courseParams, await params);

        const principal = await requirePrincipal();
        await enforceRateLimit(req, "write.default", { userId: principal.userId });
        await authorizeCourse(principal, "topic:create", routeParams.courseId);

        const { title } = await parseBody(topicCreateSchema, req);

        // Find or create a default module for the course
        let defaultModule = await db.module.findFirst({
            where: { courseId: routeParams.courseId, title: "General" },
        });
        if (!defaultModule) {
            defaultModule = await db.module.create({
                data: {
                    title: "General",
                    courseId: routeParams.courseId,
                    position: 0,
                    isPublished: true,
                },
            });
        }

        const lastTopic = await db.topic.findFirst({
            where: {
                moduleId: defaultModule.id,
            },
            orderBy: {
                position: "desc",
            },
        });

        const newPosition = lastTopic ? lastTopic.position + 1 : 1;

        const topic = await db.topic.create({
            data: {
                title,
                moduleId: defaultModule.id,
                position: newPosition,
            }
        });

        return NextResponse.json(topic);

    } catch (error) {
        return handleRouteError("CHAPTERS", error);
    }
}
