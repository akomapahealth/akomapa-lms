import "server-only";

import { db } from "@/lib/db";

/**
 * The invariant that makes retiring TEACHER_ID safe.
 *
 * Privilege now comes only from `User.role`. If a deployment reaches production
 * with no ADMIN row, nobody can administer it and there is no in-app way to fix
 * that -- role management is #88 and does not exist yet. So the count is
 * checked explicitly rather than assumed.
 *
 * This is currently exercised by `npm run role:check` as a deploy pre-flight.
 * There is no readiness endpoint to mount it on yet; #103 adds one, and should
 * call `assertAdminExists` from it.
 */
export async function countAdmins(): Promise<number> {
  return db.user.count({ where: { role: "ADMIN" } });
}

export async function assertAdminExists(): Promise<void> {
  const admins = await countAdmins();
  if (admins === 0) {
    throw new Error(
      "No user has role ADMIN. Administration is unreachable and cannot be " +
        "granted from inside the application. Run: " +
        "npm run role:grant -- --user <clerkUserId> --role ADMIN"
    );
  }
}
