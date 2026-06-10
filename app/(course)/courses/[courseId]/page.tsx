import { db } from "@/lib/db";
import { redirect } from "next/navigation";

const CourseId = async ({
    params
}: {
    params: Promise<{ courseId: string }>
}) => {
    const { courseId } = await params;

    const course = await db.course.findUnique({
        where: {
            id: courseId,
        },
        include: {
            modules: {
                where: {
                    isPublished: true,
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
                    },
                },
            },
        },
    });

    if (!course) {
        return redirect("/");
    }

    // Find the first published topic across all modules
    const firstTopic = course.modules
        .flatMap((mod) => mod.topics)
        .at(0);

    if (!firstTopic) {
        return redirect("/");
    }

    return redirect(`/courses/${course.id}/chapters/${firstTopic.id}`);
}

export default CourseId;
