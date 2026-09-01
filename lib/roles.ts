import { can, type Principal, type Role } from "@/lib/auth/policy";
import { getPrincipal } from "@/lib/auth/principal";

/**
 * @deprecated Use `@/lib/auth` directly.
 *
 * These helpers remain only so that call sites can migrate to the centralized
 * permission module incrementally rather than in one flag-day change. They now
 * delegate to `lib/auth/policy.ts` and no longer read `process.env.TEACHER_ID`:
 * privilege comes from `User.role` and nothing else (ADR 0001 section 6).
 *
 * Each helper answers "does this role clear the bar", which is exactly the
 * question that is not sufficient on its own -- it cannot see the resource. New
 * code must call `requirePrincipal()` and one of the `authorize*` guards so
 * ownership is asserted in the query. Deleted once every call site has moved.
 */

export type UserRole = Role;

async function principalFor(userId: string): Promise<Principal | null> {
  const principal = await getPrincipal();
  // Defends against a caller passing an id other than the session's. The old
  // helpers took a userId parameter, so a mismatched value must resolve to no
  // principal rather than silently authorizing the session's own role.
  if (!principal || principal.userId !== userId) return null;
  return principal;
}

export async function getUserRole(userId: string): Promise<UserRole> {
  const principal = await principalFor(userId);
  return principal?.role ?? "STUDENT";
}

export async function isAdmin(userId: string): Promise<boolean> {
  const principal = await principalFor(userId);
  return can(principal, "analytics:read");
}

export async function isFaculty(userId: string): Promise<boolean> {
  const principal = await principalFor(userId);
  return can(principal, "course:create");
}

export async function isStudent(userId: string): Promise<boolean> {
  const principal = await principalFor(userId);
  return principal?.role === "STUDENT";
}
