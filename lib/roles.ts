import { db } from "@/lib/db";

export type UserRole = "STUDENT" | "FACULTY" | "ADMIN";

export async function getUserRole(userId: string): Promise<UserRole> {
  // Fallback: check server-only env var for backward compatibility
  if (userId === process.env.TEACHER_ID) {
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
