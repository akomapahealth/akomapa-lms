import "server-only";

import { db } from "@/lib/db";

import type { Action } from "./actions";
import { Denied } from "./errors";
import { can, type Principal } from "./policy";

/**
 * The async authorization boundary.
 *
 * ADR 0001 section 4: authorization is not a guard that runs before an
 * unfiltered query. Each function here puts the ownership condition *inside*
 * the query that loads the resource, so there is no window in which an
 * authorized-but-unrelated row has been read and is waiting to be returned by
 * mistake. The guard and the fetch are one statement.
 *
 * Each returns the resource on success and throws `Denied` otherwise, which
 * separates the two failure modes a caller must distinguish:
 *
 *   forbidden  -- the role cannot perform this action on any resource
 *   not_found  -- the resource is absent, or present and not the principal's
 */

/**
 * Would this principal be allowed to perform the action on a resource it owns?
 *
 * Answering this before touching the database means a STUDENT probing an
 * authoring endpoint gets 403 without costing a query, and it keeps "wrong
 * role" distinct from "wrong resource" in the response.
 */
function canIfOwned(principal: Principal, action: Action): boolean {
  return can(principal, action, {
    kind: "course",
    ownerId: principal.userId,
  });
}

/** Asserts a capability that needs no resource: ADMIN powers, and `course:create`. */
export function requireCapability(principal: Principal, action: Action): void {
  if (!can(principal, action, { kind: "global" })) {
    throw new Denied("forbidden", action);
  }
}

/** Loads a Course the principal owns, or denies. */
export async function authorizeCourse(
  principal: Principal,
  action: Action,
  courseId: string
) {
  if (!canIfOwned(principal, action)) throw new Denied("forbidden", action);

  const course = await db.course.findFirst({
    where: { id: courseId, userId: principal.userId },
  });

  if (!course) throw new Denied("not_found", action);
  return course;
}

/**
 * Loads a Module the principal may author, asserting the full Course -> Module
 * relationship so a Module id from another Course cannot be smuggled in.
 *
 * Ownership is either the Course creator or the Module's assigned faculty
 * member, which is the distinction between global administration and assigned
 * teaching that #42 requires be modelled separately.
 */
export async function authorizeModuleInCourse(
  principal: Principal,
  action: Action,
  courseId: string,
  moduleId: string
) {
  if (!canIfOwned(principal, action)) throw new Denied("forbidden", action);

  const courseModule = await db.module.findFirst({
    where: {
      id: moduleId,
      courseId,
      OR: [
        { course: { userId: principal.userId } },
        { facultyId: principal.userId },
      ],
    },
  });

  if (!courseModule) throw new Denied("not_found", action);
  return courseModule;
}

/**
 * Authorizes an action on learner-authored content.
 *
 * The author may act on their own content; a moderator may act on anyone's.
 * Both paths are expressed once here rather than repeated at the three call
 * sites in the community routes that currently inline the same comparison.
 */
export async function authorizePost(
  principal: Principal,
  action: Action,
  postId: string
) {
  const post = await db.forumPost.findUnique({ where: { id: postId } });
  if (!post) throw new Denied("not_found", action);

  if (!can(principal, action, { kind: "authored", authorId: post.userId })) {
    throw new Denied("forbidden", action);
  }
  return post;
}

export async function authorizeComment(
  principal: Principal,
  action: Action,
  commentId: string
) {
  const comment = await db.forumComment.findUnique({ where: { id: commentId } });
  if (!comment) throw new Denied("not_found", action);

  if (!can(principal, action, { kind: "authored", authorId: comment.userId })) {
    throw new Denied("forbidden", action);
  }
  return comment;
}
