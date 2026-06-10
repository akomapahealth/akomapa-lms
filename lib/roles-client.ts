/**
 * Lightweight client-side role check.
 * For UI rendering only — NOT for security. Server-side checks must use lib/roles.ts.
 */
export function isAdminClient(userId?: string | null): boolean {
  return userId === process.env.NEXT_PUBLIC_TEACHER_ID;
}
