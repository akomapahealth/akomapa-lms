import "server-only";

import { auth } from "@clerk/nextjs/server";

import { db } from "@/lib/db";

import { Denied } from "./errors";
import { normalizeRole, type Principal } from "./policy";

/**
 * The single point at which a principal is derived (ADR 0001 section 1).
 *
 * Route handlers, server actions, and server components obtain the principal
 * here. Nothing else calls Clerk's `auth()` and reasons about the result, which
 * is what stops a handler from inventing its own notion of who is calling.
 */

/** The authenticated principal, or null when there is no session. */
export async function getPrincipal(): Promise<Principal | null> {
  const { userId } = await auth();
  if (!userId) return null;

  const user = await db.user.findUnique({
    where: { id: userId },
    select: { role: true },
  });

  // Two cases collapse to STUDENT deliberately. A missing row is a real state:
  // the Clerk webhook that creates it may not have landed yet, and a brand-new
  // learner must still be able to use the product. An unrecognised role string
  // is a corrupted row, and least privilege is the safe reading of it. Neither
  // case may ever produce a role *above* STUDENT.
  const role = normalizeRole(user?.role) ?? "STUDENT";

  return { userId, role };
}

/** The authenticated principal, or a denial. Use this at a protected boundary. */
export async function requirePrincipal(): Promise<Principal> {
  const principal = await getPrincipal();
  if (!principal) throw new Denied("unauthenticated");
  return principal;
}
