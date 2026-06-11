import { getProgress } from "@/actions/get-progress";
import { db } from "@/lib/db";
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { CourseSidebar } from "./_components/course-sidebar";
import { CourseNavbar } from "./_components/course-navbar";

const CourseLayout = async ({
    children,
    params
}: {
    children: React.ReactNode;
    params: Promise<{ courseId: string }>;
}) => {
    const { courseId } = await params;

    const { userId } = await auth();

    if (!userId) {
        return redirect("/");
    }

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
                        include: {
                            userProgress: {
                                where: {
                                    userId,
                                },
                            },
                        },
                        orderBy: {
                            position: "asc",
                        },
                    },
                },
            },
            quizzes: {
                where: {
                    isPublished: true,
                },
                select: {
                    id: true,
                    title: true,
                    type: true,
                    attempts: {
                        where: {
                            userId,
                            completedAt: { not: null },
                        },
                        orderBy: { score: "desc" },
                        take: 1,
                        select: {
                            score: true,
                            totalPoints: true,
                        },
                    },
                },
            },
        },
    })

    if (!course) {
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

    const progressCount = await getProgress(userId, course.id);

    // Map quizzes for the sidebar
    const sidebarQuizzes = course.quizzes.map((q) => {
        const bestAttempt = q.attempts[0];
        const passed = bestAttempt && bestAttempt.totalPoints
            ? (bestAttempt.score! / bestAttempt.totalPoints) * 100 >= 70
            : false;
        return {
            id: q.id,
            title: q.title,
            type: q.type,
            hasAttempt: q.attempts.length > 0,
            passed,
        };
    });

    return (
        <div className="h-full">
            <div className="h-[80px] fixed top-0 left-0 right-0 md:left-80 z-50">
                <CourseNavbar
                    course={course}
                    modules={course.modules}
                    progressCount={progressCount}
                    isPurchased={!!purchase}
                    quizzes={sidebarQuizzes}
                />
            </div>
            <div className="hidden md:flex h-full w-80 flex-col fixed inset-y-0 z-50">
                <CourseSidebar
                    course={course}
                    modules={course.modules}
                    progressCount={progressCount}
                    isPurchased={!!purchase}
                    quizzes={sidebarQuizzes}
                />
            </div>
            <main className="md:pl-80 pt-[80px] h-full">
            {children}
            </main>
        </div>
    );
}

export default CourseLayout;
