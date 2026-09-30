import type { Principal } from "@/lib/auth";
import { db } from "@/lib/db";
import { entitledCourseIds } from "@/lib/entitlement";

export type ModuleStatus = "NOT_STARTED" | "IN_PROGRESS" | "COMPLETED";

export interface EnrolledModule {
  id: string;
  title: string;
  description: string | null;
  imageUrl: string | null;
  position: number;
  courseId: string;
  courseTitle: string;
  totalTopics: number;
  completedTopics: number;
  progress: number;
  status: ModuleStatus;
}

export const getEnrolledModules = async (
  principal: Principal,
  filter?: "all" | "in_progress" | "completed" | "not_started",
  search?: string
): Promise<EnrolledModule[]> => {
  try {
    const userId = principal.userId;

    // One source (ADR 0002). This used to be the union of purchases and ACTIVE
    // enrollments, which is exactly the "OR" the ADR rejects: the weaker
    // condition wins, so a suspended learner kept every Module they had paid for.
    // It also dropped COMPLETED enrollments, so finishing a Course made its
    // Modules disappear from this list.
    const courseIds = await entitledCourseIds(principal);

    if (courseIds.length === 0) return [];

    const modules = await db.module.findMany({
      where: {
        courseId: { in: courseIds },
        isPublished: true,
        ...(search
          ? { title: { contains: search, mode: "insensitive" as const } }
          : {}),
      },
      orderBy: [{ course: { title: "asc" } }, { position: "asc" }],
      select: {
        id: true,
        title: true,
        description: true,
        imageUrl: true,
        position: true,
        courseId: true,
        course: { select: { title: true } },
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

    const result: EnrolledModule[] = modules.map((mod) => {
      const totalTopics = mod.topics.length;
      const completedTopics = mod.topics.filter(
        (t) => t.userProgress[0]?.isCompleted
      ).length;

      let status: ModuleStatus = "NOT_STARTED";
      if (totalTopics > 0 && completedTopics === totalTopics) {
        status = "COMPLETED";
      } else if (completedTopics > 0) {
        status = "IN_PROGRESS";
      }

      return {
        id: mod.id,
        title: mod.title,
        description: mod.description,
        imageUrl: mod.imageUrl,
        position: mod.position,
        courseId: mod.courseId,
        courseTitle: mod.course.title,
        totalTopics,
        completedTopics,
        progress:
          totalTopics > 0
            ? Math.round((completedTopics / totalTopics) * 100)
            : 0,
        status,
      };
    });

    if (filter && filter !== "all") {
      const statusMap: Record<string, ModuleStatus> = {
        in_progress: "IN_PROGRESS",
        completed: "COMPLETED",
        not_started: "NOT_STARTED",
      };
      return result.filter((m) => m.status === statusMap[filter]);
    }

    return result;
  } catch (error) {
    console.log("[GET_ENROLLED_MODULES]", error);
    return [];
  }
};
