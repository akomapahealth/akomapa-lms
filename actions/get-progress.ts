import { db } from "@/lib/db";

export const getProgress = async (
    userId: string,
    courseId: string,
): Promise<number> => {
    try {
        // Find all published topics across all modules in this course
        const publishedTopics = await db.topic.findMany({
            where: {
                module: {
                    courseId: courseId,
                },
                isPublished: true,
            },
            select: {
                id: true,
            }
        });

        const publishedTopicIds = publishedTopics.map((topic) => topic.id);

        if (publishedTopicIds.length === 0) {
            return 0;
        }

        const validCompletedTopics = await db.userProgress.count({
            where: {
                userId: userId,
                topicId: {
                    in: publishedTopicIds
                },
                isCompleted: true,
            }
        });

        const progressPercentage = (validCompletedTopics / publishedTopicIds.length) * 100;

        return progressPercentage;
    } catch (error) {
        console.log("[GET_PROGRESS]", error);
        return 0;
    }
}
