import { db } from "@/lib/db";

export type UserRole = "STUDENT" | "FACULTY" | "ADMIN";

export async function getUserRole(userId: string): Promise<UserRole> {
  // Fallback: check server-only env var for backward compatibility.
  // Both sides must be non-empty. `TEACHER_ID` is `z.string().optional()`, so a
  // blank value is valid configuration, and a blank `userId` is what an
  // unauthenticated caller produces — comparing them would grant ADMIN to
  // anonymous requests on any deployment that defines the variable but leaves
  // it empty. Callers guard with `if (!userId)` today; this makes the grant
  // safe regardless of whether a future caller remembers to.
  const teacherId = process.env.TEACHER_ID;
  if (teacherId && userId && userId === teacherId) {
    return "ADMIN";
  }

  const user = await db.user.findUnique({
    where: { id: userId },
    select: { role: true },
  });

  return (user?.role as UserRole) ?? "STUDENT";
}

export async function isAdmin(userId: string): Promise<boolean> {
  const role = await getUserRole(userId);
  return role === "ADMIN";
}

export async function isFaculty(userId: string): Promise<boolean> {
  const role = await getUserRole(userId);
  return role === "FACULTY" || role === "ADMIN";
}

export async function isStudent(userId: string): Promise<boolean> {
  const role = await getUserRole(userId);
  return role === "STUDENT";
}
