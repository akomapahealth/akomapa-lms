import { NextResponse } from "next/server";

import { db } from "@/lib/db";
import { requirePrincipal, toResponse } from "@/lib/auth";
import { topicBelongsToCourse } from "@/lib/courses/topic-access";
import { evaluateBadges, type BadgeEvent } from "@/lib/badge-service";
import { updateStreak } from "@/lib/streak-service";
import { generateCertificate } from "@/lib/certificate-service";
import { logError } from "@/lib/logger";

export async function PUT(
    req: Request,
    { params }: { params: Promise<{ courseId: string; chapterId: string }> }
) {
        const routeParams = await params;

    try {
        const { userId } = await requirePrincipal();

        // The Topic must actually be in this Course. Without this, a progress
        // write could be aimed at any Topic in the product by id, and the
        // completion cascade below -- badges, streaks, Enrollment status, and
        // certificate issuance -- would run for a Course the learner is not on.
        // Entitlement itself (must the learner be enrolled?) is #40.
        if (!(await topicBelongsToCourse(routeParams.courseId, routeParams.chapterId))) {
            return new NextResponse("Not Found", { status: 404 });
        }

        const { isCompleted } = await req.json();

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

                    // Auto-generate certificate on course completion
                    try {
                        await generateCertificate(userId, routeParams.courseId);
                    } catch (err) {
                        logError("CERTIFICATE_AUTO_GENERATE", err);
                    }
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
        const denied = toResponse(error);
        if (denied) return denied;

        logError("CHAPTER_ID_PROGRESS", error);
        return new NextResponse("Internal Error", { status: 500 });
    }
}