import { db } from "@/lib/db";
import { Category, Course, Module, Topic, Quiz } from "@prisma/client";
import { getProgress } from "./get-progress";

export type CourseStatus = "NOT_STARTED" | "IN_PROGRESS" | "COMPLETED";

export type EnrolledCourse = Course & {
  category: Category | null;
  modules: (Module & { topics: Topic[] })[];
  quizzes: Quiz[];
  progress: number;
  status: CourseStatus;
  moduleCount: number;
  topicCount: number;
  quizCount: number;
};

export const getEnrolledCourses = async (
  userId: string,
  filter?: "all" | "in_progress" | "completed" | "not_started",
  search?: string
): Promise<EnrolledCourse[]> => {
  try {
    const purchasedCourses = await db.purchase.findMany({
      where: {
        userId,
      },
      select: {
        course: {
          include: {
            category: true,
            modules: {
              where: { isPublished: true },
              orderBy: { position: "asc" },
              include: {
                topics: {
                  where: { isPublished: true },
                  orderBy: { position: "asc" },
                },
              },
            },
            quizzes: true,
          },
        },
      },
    });

    let courses: EnrolledCourse[] = [];

    for (const purchase of purchasedCourses) {
      const course = purchase.course;
      const progress = await getProgress(userId, course.id);
      const moduleCount = course.modules.length;
      const topicCount = course.modules.reduce(
        (acc, mod) => acc + mod.topics.length,
        0
      );
      const quizCount = course.quizzes.length;

      let status: CourseStatus = "NOT_STARTED";
      if (progress === 100) {
        status = "COMPLETED";
      } else if (progress > 0) {
        status = "IN_PROGRESS";
      }

      courses.push({
        ...course,
        progress,
        status,
        moduleCount,
        topicCount,
        quizCount,
      });
    }

    // Apply search filter
    if (search) {
      const searchLower = search.toLowerCase();
      courses = courses.filter((c) =>
        c.title.toLowerCase().includes(searchLower)
      );
    }

    // Apply status filter
    if (filter && filter !== "all") {
      const statusMap: Record<string, CourseStatus> = {
        in_progress: "IN_PROGRESS",
        completed: "COMPLETED",
        not_started: "NOT_STARTED",
      };
      const targetStatus = statusMap[filter];
      if (targetStatus) {
        courses = courses.filter((c) => c.status === targetStatus);
      }
    }

    return courses;
  } catch (error) {
    console.log("[GET_ENROLLED_COURSES]", error);
    return [];
  }
};
