/**
 * Completion rules.
 *
 * Pure: no database, no clock. Completion decides whether a certificate is
 * issued, which is the product's only externally verifiable claim, so the rule
 * is worth being able to test exhaustively rather than inferring from a route
 * handler.
 *
 * The rule that matters is that completion is **non-vacuous**. `[].every()` is
 * `true`, so a Course with no published Topics -- a draft, or one whose Topics
 * were all unpublished -- satisfied a naive check and issued a certificate for
 * finishing nothing. Emptiness is not completion.
 *
 * #59 owns the fuller definition (prerequisites, required vs optional Topics);
 * this is the invariant that must hold under any of them.
 */

export interface TopicCompletion {
  id: string;
  completed: boolean;
}

export interface ModuleCompletion {
  topics: TopicCompletion[];
}

/**
 * Treats `justCompletedId` as complete regardless of what was read.
 *
 * The progress write and the completion read are separate statements, so the
 * row for the Topic being completed may still show its old value. Passing the
 * id explicitly avoids depending on read-after-write ordering. #49 makes the
 * whole sequence one transaction.
 */
function isDone(topic: TopicCompletion, justCompletedId: string): boolean {
  return topic.id === justCompletedId || topic.completed;
}

/** A Module is complete when it has at least one Topic and all of them are done. */
export function isModuleComplete(
  courseModule: ModuleCompletion,
  justCompletedId: string
): boolean {
  if (courseModule.topics.length === 0) return false;
  return courseModule.topics.every((topic) => isDone(topic, justCompletedId));
}

/**
 * A Course is complete when it has at least one published Topic and every one
 * of them is done.
 *
 * Counting Topics rather than Modules means a Module that happens to hold no
 * published Topics neither blocks completion nor manufactures it.
 */
export function isCourseComplete(
  modules: ModuleCompletion[],
  justCompletedId: string
): boolean {
  const topics = modules.flatMap((courseModule) => courseModule.topics);
  if (topics.length === 0) return false;
  return topics.every((topic) => isDone(topic, justCompletedId));
}
