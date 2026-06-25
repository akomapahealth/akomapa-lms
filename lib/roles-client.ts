/**
 * Client-side role check using Clerk's publicMetadata.
 * For UI rendering only — NOT for security. Server-side checks must use lib/roles.ts.
 */
export function isAdminClient(publicMetadata?: Record<string, unknown> | null): boolean {
  return publicMetadata?.role === "ADMIN";
}

export function isFacultyClient(publicMetadata?: Record<string, unknown> | null): boolean {
  const role = publicMetadata?.role;
  return role === "FACULTY" || role === "ADMIN";
}
