import { NextResponse } from "next/server";

import { db } from "@/lib/db";
import { authorizeCourse, requirePrincipal } from "@/lib/auth";
import { assertTrustedOrigin, handleRouteError, parseBody, parseParams } from "@/lib/http";
import { withPositionRetry } from "@/lib/courses/ordering";
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

        // Find or create the Course's default "General" Module, then append the
        // Topic. Both reads race concurrent creates for a position, and the
        // per-parent unique indexes refuse the loser, which reads again (#51).
        // The default Module takes the next free position rather than 0, which
        // another Module may already hold.
        const topic = await withPositionRetry(async () => {
            let defaultModule = await db.module.findFirst({
                where: { courseId: routeParams.courseId, title: "General" },
            });
            if (!defaultModule) {
                const lastModule = await db.module.findFirst({
                    where: { courseId: routeParams.courseId },
                    orderBy: { position: "desc" },
                });
                defaultModule = await db.module.create({
                    data: {
                        title: "General",
                        courseId: routeParams.courseId,
                        position: lastModule ? lastModule.position + 1 : 0,
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

            return db.topic.create({
                data: {
                    title,
                    moduleId: defaultModule.id,
                    position: lastTopic ? lastTopic.position + 1 : 1,
                }
            });
        });

        return NextResponse.json(topic);

    } catch (error) {
        return handleRouteError("CHAPTERS", error);
    }
}
