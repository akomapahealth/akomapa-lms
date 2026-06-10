import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

import { db } from "@/lib/db";

export async function PUT(
    req: Request,
    { params }: { params: Promise<{ courseId: string; chapterId: string }> }
) {
        const routeParams = await params;

    try {
        const { userId } = await auth();
        const { isCompleted } = await req.json();

        if (!userId) {
            return new NextResponse("Unauthorized", { status: 401 });
        }

        const userProgress = await db.userProgress.upsert({
            where: {
                userId_topicId: {
                    userId,
                    topicId: routeParams.chapterId,
                }
            },
            update: {
                isCompleted
            },
            create: {
                userId,
                topicId: routeParams.chapterId,
                isCompleted,
            }
        });

        // Check if this completion finishes the entire module
        let isModuleComplete = false;
        let moduleName = "";

        if (isCompleted) {
            const topic = await db.topic.findUnique({
                where: { id: routeParams.chapterId },
                select: {
                    moduleId: true,
                    module: {
                        select: {
                            title: true,
                            topics: {
                                where: { isPublished: true },
                                select: {
                                    id: true,
                                    userProgress: {
                                        where: { userId },
                                        select: { isCompleted: true },
                                    },
                                },
                            },
                        },
                    },
                },
            });

            if (topic?.module) {
                moduleName = topic.module.title;
                isModuleComplete = topic.module.topics.every((t) =>
                    t.id === routeParams.chapterId
                        ? true // just completed this one
                        : t.userProgress.some((p) => p.isCompleted)
                );
            }
        }

        return NextResponse.json({
            ...userProgress,
            isModuleComplete,
            moduleName,
        });

    } catch (error) {
        console.log("[CHAPTER_ID_PROGRESS]", error);
        return new NextResponse("Internal Error", { status: 500 });
    }
}