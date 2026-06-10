import { db } from "@/lib/db";
import { auth } from "@clerk/nextjs/server";
import { Course, Topic, UserProgress } from "@prisma/client";
import { redirect } from "next/navigation";
import { CourseSidebarItem } from "./course-sidebar-item";
import { CourseProgress } from "@/components/course-progress";

type TopicWithProgress = Topic & {
    userProgress: UserProgress[] | null;
};

interface CourseSidebarProps {
    course: Course;
    topics: TopicWithProgress[];
    progressCount: number;
};

export const CourseSidebar = async ({
    course,
    topics,
    progressCount
}: CourseSidebarProps) => {
    const { userId } = await auth();

    if (!userId) {
        return redirect("/");
    }

    const purchase = await db.purchase.findUnique({
        where: {
            userId_courseId: {
                userId,
                courseId: course.id,
            }
        }
    });

    return (
        <div className="h-full border-r flex flex-col overflow-y-auto shadow-sm">
            <div className="p-8 flex flex-col border-b">
                <h1 className="font-semibold">
                    {course.title}
                </h1>
                {purchase && (
                    <div className="mt-10">
                        <CourseProgress
                            variant="success"
                            value={progressCount}
                        />
                    </div>
                )}
            </div>
            <div className="flex flex-col w-full">
                {topics.map((topic) => (
                    <CourseSidebarItem
                        key={topic.id}
                        id={topic.id}
                        label={topic.title}
                        isCompleted={!!topic.userProgress?.[0]?.isCompleted}
                        courseId={course.id}
                        isLocked={!topic.isFree && !purchase}
                    />
                ))}
            </div>
        </div>
     );
}
