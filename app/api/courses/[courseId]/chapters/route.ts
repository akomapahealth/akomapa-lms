import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

import { db } from "@/lib/db";
export async function POST(
    req: Request,
    { params }: { params: Promise<{ courseId: string }> }
) {
        const routeParams = await params;

    try {
        const { userId } = await auth();
        const { title } = await req.json();

        if (!userId) {
            return new NextResponse("Unauthorized", { status: 401 });
        }

        const courseOwner = await db.course.findUnique({
            where: {
                id: routeParams.courseId,
                userId: userId,
            }
        });

        if (!courseOwner) {
            return new NextResponse("Unauthorized", { status: 401 });
        }

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
        console.log("[CHAPTERS]", error);
        return new NextResponse("Internal Server Error", { status: 500 })
    }
}