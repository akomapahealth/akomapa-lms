import { db } from "@/lib/db";
import { Attachment, Topic } from "@prisma/client";

interface GetTopicProps {
    userId: string;
    courseId: string;
    topicId: string;
};

export const getTopic = async ({
    userId,
    courseId,
    topicId,
}: GetTopicProps) => {
    try {
        const purchase = await db.purchase.findUnique({
            where: {
                userId_courseId: {
                    userId,
                    courseId,
                }
            }
        });

        const course = await db.course.findUnique({
            where: {
                isPublished: true,
                id: courseId,
            },
            select: {
                price: true,
            }
        });

        const topic = await db.topic.findUnique({
            where: {
                id: topicId,
                isPublished: true,
            },
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

        if (purchase) {
            attachments = await db.attachment.findMany({
                where: {
                    courseId: courseId,
                }
            });
        }

        if (topic.isFree || purchase) {
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
            userProgress,
            purchase,
        };
    } catch (error) {
        console.log("[GET_TOPIC]", error);
        return {
            topic: null,
            course: null,
            muxData: null,
            attachments: [],
            nextTopic: null,
            userProgress: null,
            purchase: null,
        }
    }
}
