/**
 * The action vocabulary.
 *
 * Every authorization decision in the application names one of these. The union
 * is exhaustive on purpose: a typo becomes a build error rather than a check
 * that silently never matches, and `policy.ts` must map every member to a rule,
 * so adding an action without deciding who may perform it does not compile.
 *
 * Actions are named `subject:verb`. The subject is the domain noun from
 * CONTEXT.md, never a route path — routes move, the domain does not.
 */
export const ACTIONS = [
  // Course authoring. Ownership is required; see docs/permission-matrix.md.
  "course:create",
  "course:read",
  "course:update",
  "course:delete",
  "course:publish",

  // Module, Topic, and Attachment authoring. These hang off a Course, so
  // ownership resolves through the owning Course or an assigned faculty member.
  "module:create",
  "module:update",
  "module:delete",
  "module:reorder",
  "topic:create",
  "topic:update",
  "topic:delete",
  "topic:reorder",
  "attachment:create",
  "attachment:delete",

  // Assessment authoring.
  "quiz:create",
  "quiz:read",
  "quiz:update",
  "quiz:delete",
  "quiz:publish",
  "question:create",
  "question:update",
  "question:delete",
  "question:reorder",

  // Case Study authoring.
  "caseStudy:create",
  "caseStudy:update",
  "caseStudy:delete",

  // Community. `community:moderate` is the ADMIN capability covering pinning,
  // locking, category management, and acting on content the principal did not
  // write. Authors edit and delete their own content without it.
  "community:moderate",
  "post:update",
  "post:delete",
  "comment:update",
  "comment:delete",

  // Administration.
  "analytics:read",
  "learner:administer",
  "role:manage",

  // Learner access to purchased Course content.
  "course:learn",

  // Authoring uploads (course images, attachments, Topic video).
  "upload:courseAsset",

  // Reserved. These surfaces do not exist yet, so the policy denies them
  // unconditionally rather than leaving the name free for a future caller to
  // assume is permitted. #72/#73 and #79 own them.
  "billing:administer",
  "ai:administer",
] as const;

export type Action = (typeof ACTIONS)[number];

const ACTION_SET: ReadonlySet<string> = new Set(ACTIONS);

/** Narrows an untrusted string to a known action. Unknown input is not an action. */
export function isAction(value: unknown): value is Action {
  return typeof value === "string" && ACTION_SET.has(value);
}
