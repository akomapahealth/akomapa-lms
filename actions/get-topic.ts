import type { Principal } from "@/lib/auth";
import { db } from "@/lib/db";
import { topicEntitlement } from "@/lib/entitlement";
import { logError } from "@/lib/logger";
import { publishedTopicInCourse } from "@/lib/courses/topic-access";
import { Attachment, Topic } from "@prisma/client";

interface GetTopicProps {
    principal: Principal;
    courseId: string;
    topicId: string;
};

export const getTopic = async ({
    principal,
    courseId,
    topicId,
}: GetTopicProps) => {
    const userId = principal.userId;

    try {
        // One entitlement decision, covering enrollment status and free preview
        // together (ADR 0002). `purchase` used to gate video, attachments, and
        // navigation, so a suspended learner kept all three.
        const entitlement = await topicEntitlement(principal, courseId, topicId);

        const course = await db.course.findUnique({
            where: {
                isPublished: true,
                id: courseId,
            },
            select: {
                price: true,
            }
        });

        // Bound to the Course through its Module. Loading by id alone meant a
        // Topic id from any Course resolved here, and the entitlement check
        // below looks at the *route's* Course -- so a purchase of one Course
        // unlocked video and attachments in another.
        const topic = await db.topic.findFirst({
            where: publishedTopicInCourse(courseId, topicId),
            include: {
                module: true,
            }
        });

        if (!topic || !course) {
            throw new Error("Topic or course not found!");
        }

        let muxData = null;
        let attachments: Attachment[] = [];
        let nextTopic: Topic | null = null;
        let previousTopic: Topic | null = null;

        // Attachments are paid content: a free-preview Topic does not unlock them.
        if (entitlement.canLearn) {
            attachments = await db.attachment.findMany({
                where: {
                    courseId: courseId,
                }
            });
        }

        if (entitlement.canReadTopic) {
            muxData = await db.muxData.findUnique({
                where: {
                    topicId: topicId,
                }
            });

            // Find the next topic: first try within the same module, then in subsequent modules
            nextTopic = await db.topic.findFirst({
                where: {
                    moduleId: topic.moduleId,
                    isPublished: true,
                    position: {
                        gt: topic.position,
                    }
                },
                orderBy: {
                    position: "asc",
                }
            });

            // If no next topic in the same module, look in the next modules of the same course
            if (!nextTopic) {
                const nextModule = await db.module.findFirst({
                    where: {
                        courseId: courseId,
                        isPublished: true,
                        position: {
                            gt: topic.module.position,
                        }
                    },
                    orderBy: {
                        position: "asc",
                    },
                    include: {
                        topics: {
                            where: {
                                isPublished: true,
                            },
                            orderBy: {
                                position: "asc",
                            },
                            take: 1,
                        }
                    }
                });

                if (nextModule && nextModule.topics.length > 0) {
                    nextTopic = nextModule.topics[0];
                }
            }

            // Find the previous topic: first try within the same module, then in previous modules
            previousTopic = await db.topic.findFirst({
                where: {
                    moduleId: topic.moduleId,
                    isPublished: true,
                    position: {
                        lt: topic.position,
                    }
                },
                orderBy: {
                    position: "desc",
                }
            });

            if (!previousTopic) {
                const prevModule = await db.module.findFirst({
                    where: {
                        courseId: courseId,
                        isPublished: true,
                        position: {
                            lt: topic.module.position,
                        }
                    },
                    orderBy: {
                        position: "desc",
                    },
                    include: {
                        topics: {
                            where: {
                                isPublished: true,
                            },
                            orderBy: {
                                position: "desc",
                            },
                            take: 1,
                        }
                    }
                });

                if (prevModule && prevModule.topics.length > 0) {
                    previousTopic = prevModule.topics[0];
                }
            }
        }

        const userProgress = await db.userProgress.findUnique({
            where: {
                userId_topicId: {
                    userId,
                    topicId,
                }
            }
        });

        return {
            topic,
            course,
            muxData,
            attachments,
            nextTopic,
            previousTopic,
            userProgress,
            entitlement,
        };
    } catch (error) {
        // Redacted in production; console.log printed the whole error object.
        logError("GET_TOPIC", error);
        return {
            topic: null,
            course: null,
            muxData: null,
            attachments: [],
            nextTopic: null,
            previousTopic: null,
            userProgress: null,
            entitlement: null,
        };
    }
};
