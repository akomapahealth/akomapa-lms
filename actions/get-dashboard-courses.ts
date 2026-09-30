import type { Principal } from "@/lib/auth";
import { db } from "@/lib/db";
import { entitledCourseIds } from "@/lib/entitlement";
import { Category, Topic, Course, Module } from "@prisma/client";
import { getProgress } from "./get-progress";

type CourseWithProgressWithCategory = Course & {
    category: Category;
    modules: (Module & { topics: Topic[] })[];
    progress: number | null;
}

type DashboardCourses = {
    completedCourses: CourseWithProgressWithCategory[];
    coursesInProgress: CourseWithProgressWithCategory[];
}

export const getDashboardCourses = async (principal: Principal): Promise<DashboardCourses> => {
    try {
        const userId = principal.userId;

        // Entitled, not purchased (ADR 0002).
        const courseIds = await entitledCourseIds(principal);
        if (courseIds.length === 0) {
            return { completedCourses: [], coursesInProgress: [] };
        }

        const entitledCourses = await db.course.findMany({
            where: { id: { in: courseIds } },
            include: {
                category: true,
                modules: {
                    where: {
                        isPublished: true,
                    },
                    include: {
                        topics: {
                            where: {
                                isPublished: true,
                            }
                        }
                    }
                }
            }
        });

        const courses = entitledCourses as CourseWithProgressWithCategory[];

        for (let course of courses) {
            const progress = await getProgress(userId, course.id);
            course["progress"] = progress;
        }

        const completedCourses = courses.filter((course) => course.progress === 100);
        const coursesInProgress = courses.filter((course) => (course.progress ?? 0) < 100);

        return {
            completedCourses,
            coursesInProgress,
        };
    } catch (error) {
        console.log("[GET_DASHBOARD_COURSES]", error);
        return {
            completedCourses: [],
            coursesInProgress: [],
        };
    }
};
