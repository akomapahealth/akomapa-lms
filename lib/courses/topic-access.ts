import "server-only";

import { db } from "@/lib/db";

/**
 * The Course → Module → Topic relationship, asserted in one place.
 *
 * A Topic id in a URL proves nothing about which Course it belongs to. Loading
 * a Topic by id alone and trusting the Course id that arrived beside it is the
 * defect in #39: substituting another Course's Topic id into a purchased
 * Course's URL returned that Topic's content, and because the entitlement check
 * looked at the *URL's* Course, owning one Course unlocked video in another.
 *
 * The relationship is expressed as a `where` fragment rather than a check that
 * runs after a query, so it cannot be forgotten at a call site and cannot be
 * true-but-unused. Every learner and authoring path that accepts a Topic id
 * composes one of these.
 */

/**
 * A Topic that is visible to a learner: published, in a published Module, in
 * the named Course.
 *
 * Publication is part of the relationship, not a separate concern. An
 * unpublished Module must not expose its Topics even when the Topic itself is
 * published, or withdrawing a Module from learners would not actually withdraw
 * anything.
 */
export function publishedTopicInCourse(courseId: string, topicId: string) {
  return {
    id: topicId,
    isPublished: true,
    module: {
      courseId,
      isPublished: true,
    },
  } as const;
}

/**
 * A Topic in the named Course regardless of publication state, for authoring.
 *
 * Staff work on unpublished content by definition, so this omits the
 * publication filter — but never the Course binding.
 */
export function topicInCourse(courseId: string, topicId: string) {
  return {
    id: topicId,
    module: { courseId },
  } as const;
}

/** Loads a learner-visible Topic, or null when it does not belong to the Course. */
export async function findPublishedTopicInCourse(
  courseId: string,
  topicId: string
) {
  return db.topic.findFirst({
    where: publishedTopicInCourse(courseId, topicId),
    include: { module: true },
  });
}

/**
 * Does this Topic belong to this Course at all?
 *
 * Used by mutations that need the relationship but not the row, so that a
 * progress write cannot be aimed at a Topic in a Course the learner is not on.
 */
export async function topicBelongsToCourse(
  courseId: string,
  topicId: string
): Promise<boolean> {
  const found = await db.topic.findFirst({
    where: topicInCourse(courseId, topicId),
    select: { id: true },
  });
  return found !== null;
}
