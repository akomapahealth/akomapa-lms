import "server-only";

import { notFound, redirect } from "next/navigation";

import type { Action } from "./actions";
import { isDenied } from "./errors";
import { authorizeCourse } from "./guards";
import { can, type Principal } from "./policy";
import { getPrincipal } from "./principal";

/**
 * Page-level authorization for server components.
 *
 * Route handlers throw `Denied` and map it to a status code. A page cannot do
 * that usefully -- a person needs somewhere to go -- so these redirect instead.
 * The decision itself is the same `can` call; only the failure shape differs.
 *
 * Every page under a protected shell calls one of these. The shell no longer
 * makes the decision on their behalf: `admin/layout.tsx` used to gate on
 * "FACULTY or better" and seven of the nine pages beneath it had no check at
 * all, so any faculty member reached every administration page.
 */

/** Requires a capability that needs no resource. Redirects rather than throwing. */
export async function requirePageCapability(action: Action): Promise<Principal> {
  const principal = await getPrincipal();

  if (!principal) redirect("/sign-in");
  if (!can(principal, action)) redirect("/dashboard");

  return principal;
}

/**
 * Requires a capability on a specific Course, asserting ownership in the query.
 *
 * A denial renders the not-found page rather than a distinct "forbidden" page,
 * for the same reason the route handlers answer 404: distinguishing "this Course
 * is not yours" from "no such Course" lets someone enumerate other people's
 * Courses by watching which error they get.
 */
export async function requirePageCourse(action: Action, courseId: string) {
  const principal = await getPrincipal();
  if (!principal) redirect("/sign-in");

  try {
    const course = await authorizeCourse(principal, action, courseId);
    return { principal, course };
  } catch (error) {
    if (isDenied(error)) notFound();
    throw error;
  }
}

/**
 * What the navigation is allowed to show.
 *
 * Derived on the server and passed down as plain booleans, so a client
 * component never decides anything -- it only renders what it was told. Nothing
 * about identity is read from the browser (ADR 0001 section 5).
 *
 * This exists because navigation that offers a link the principal cannot follow
 * is a bug: the person clicks and is bounced, with no explanation.
 */
export interface StaffCapabilities {
  canAccessStaffArea: boolean;
  canModerateCommunity: boolean;
  canReadAnalytics: boolean;
  canAdministerLearners: boolean;
}

export const NO_STAFF_CAPABILITIES: StaffCapabilities = {
  canAccessStaffArea: false,
  canModerateCommunity: false,
  canReadAnalytics: false,
  canAdministerLearners: false,
};

export async function getStaffCapabilities(): Promise<StaffCapabilities> {
  const principal = await getPrincipal();
  if (!principal) return NO_STAFF_CAPABILITIES;

  return {
    canAccessStaffArea: can(principal, "staff:access"),
    canModerateCommunity: can(principal, "community:moderate"),
    canReadAnalytics: can(principal, "analytics:read"),
    canAdministerLearners: can(principal, "learner:administer"),
  };
}
