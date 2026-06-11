import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

import { db } from "@/lib/db";
import { evaluateBadges, type BadgeEvent } from "@/lib/badge-service";
import { updateStreak } from "@/lib/streak-service";

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

            // Gamification: update streak and evaluate badges
            const currentStreak = await updateStreak(userId);

            const badgeEvents: BadgeEvent[] = [
                { type: "topic_completed", topicId: routeParams.chapterId },
                { type: "streak_updated", currentStreak },
            ];

            if (isModuleComplete && topic?.moduleId) {
                badgeEvents.push({ type: "module_completed", moduleId: topic.moduleId });
            }

            // Check if entire course is complete
            if (isModuleComplete) {
                const allModules = await db.module.findMany({
                    where: { courseId: routeParams.courseId, isPublished: true },
                    include: {
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
                });

                const isCourseComplete = allModules.every((mod) =>
                    mod.topics.every((t) =>
                        t.id === routeParams.chapterId
                            ? true
                            : t.userProgress.some((p) => p.isCompleted)
                    )
                );

                if (isCourseComplete) {
                    badgeEvents.push({ type: "course_completed", courseId: routeParams.courseId });

                    // Mark enrollment as completed
                    await db.enrollment.updateMany({
                        where: { userId, courseId: routeParams.courseId },
                        data: { status: "COMPLETED" },
                    });
                }
            }

            // Evaluate all badge events
            const allAwardedBadges = [];
            for (const event of badgeEvents) {
                const awarded = await evaluateBadges(userId, event);
                allAwardedBadges.push(...awarded);
            }

            return NextResponse.json({
                ...userProgress,
                isModuleComplete,
                moduleName,
                awardedBadges: allAwardedBadges.map((b) => ({
                    id: b.id,
                    name: b.name,
                    description: b.description,
                    type: b.type,
                })),
            });
        }

        return NextResponse.json({
            ...userProgress,
            isModuleComplete,
            moduleName,
            awardedBadges: [],
        });

    } catch (error) {
        console.log("[CHAPTER_ID_PROGRESS]", error);
        return new NextResponse("Internal Error", { status: 500 });
    }
}