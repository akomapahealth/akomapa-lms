import { NextResponse } from "next/server";

import { db } from "@/lib/db";
import { authorizeCourse, requirePrincipal, toResponse } from "@/lib/auth";
import { logError } from "@/lib/logger";

export async function POST(
    req: Request,
    { params }: { params: Promise<{ courseId: string }> }
) {
        const routeParams = await params;

    try {
        const principal = await requirePrincipal();
        await authorizeCourse(principal, "topic:create", routeParams.courseId);

        const { title } = await req.json();

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
        const denied = toResponse(error);
        if (denied) return denied;

        logError("CHAPTERS", error);
        return new NextResponse("Internal Server Error", { status: 500 })
    }
}