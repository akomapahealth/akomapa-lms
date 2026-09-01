import { type Action, isAction } from "./actions";

/**
 * The permission matrix, as a pure function.
 *
 * Nothing here touches the database, the network, or the clock. That is the
 * whole point: every role x action x ownership combination can be asserted in a
 * unit test that runs in microseconds, so the matrix is cheap to cover
 * exhaustively rather than sampled. The async work of *loading* a resource with
 * its ownership asserted lives in `guards.ts`.
 *
 * Implements ADR 0001. Documented in docs/permission-matrix.md.
 */

export type Role = "STUDENT" | "FACULTY" | "ADMIN";

export interface Principal {
  userId: string;
  role: Role;
}

/**
 * What a decision is being made *about*.
 *
 * A rule and a resource must agree in kind. A mismatch is a denial, never a
 * fallthrough: asking whether a principal may update a Course while passing a
 * forum post is a programming error, and the safe answer to a programming error
 * in an authorization path is "no".
 */
export type Resource =
  /** No resource: the action is global, or the resource does not exist yet. */
  | { kind: "global" }
  /** A Course, identified by its creator. */
  | { kind: "course"; ownerId: string }
  /** A Module: owned by the Course creator, or by its assigned faculty member. */
  | { kind: "module"; courseOwnerId: string; assignedFacultyId: string | null }
  /** Learner-authored content: a forum post, a comment. */
  | { kind: "authored"; authorId: string }
  /** A learner's relationship to a Course. */
  | { kind: "enrollment"; status: string };

type Rule =
  /** ADMIN only. Ownership is not consulted. */
  | "adminOnly"
  /** FACULTY or ADMIN. No resource ownership required. */
  | "facultyGlobal"
  /** FACULTY or ADMIN, and the principal must own the resource. */
  | "facultyOwned"
  /** The author, or anyone holding `community:moderate`. */
  | "authorOrModerator"
  /**
   * The author, and nobody else -- not even a moderator.
   *
   * Editing someone's words leaves their name on text they did not write, which
   * is worse than removing it. Moderation removes; it does not rewrite. #89
   * revisits this when it adds audit trails and reversible actions.
   */
  | "authorOnly"
  /** A learner whose Enrollment is not suspended. */
  | "activeEnrollment"
  /** Reserved: denied unconditionally until the owning issue implements it. */
  | "reserved";

/**
 * Every action maps to exactly one rule. `Record<Action, Rule>` makes this
 * total: adding an action to the vocabulary without deciding its rule is a
 * type error.
 */
const RULES: Record<Action, Rule> = {
  "course:create": "facultyGlobal",
  "course:read": "facultyOwned",
  "course:update": "facultyOwned",
  "course:delete": "facultyOwned",
  "course:publish": "facultyOwned",

  "module:create": "facultyOwned",
  "module:update": "facultyOwned",
  "module:delete": "facultyOwned",
  "module:reorder": "facultyOwned",
  "topic:create": "facultyOwned",
  "topic:update": "facultyOwned",
  "topic:delete": "facultyOwned",
  "topic:reorder": "facultyOwned",
  "attachment:create": "facultyOwned",
  "attachment:delete": "facultyOwned",

  "quiz:create": "facultyOwned",
  "quiz:read": "facultyOwned",
  "quiz:update": "facultyOwned",
  "quiz:delete": "facultyOwned",
  "quiz:publish": "facultyOwned",
  "question:create": "facultyOwned",
  "question:update": "facultyOwned",
  "question:delete": "facultyOwned",
  "question:reorder": "facultyOwned",

  "caseStudy:create": "facultyOwned",
  "caseStudy:update": "facultyOwned",
  "caseStudy:delete": "facultyOwned",

  "community:moderate": "adminOnly",
  "post:update": "authorOrModerator",
  "post:delete": "authorOrModerator",
  "comment:update": "authorOnly",
  "comment:delete": "authorOrModerator",

  "staff:access": "facultyGlobal",

  "analytics:read": "adminOnly",
  "learner:administer": "adminOnly",
  "role:manage": "adminOnly",

  "course:learn": "activeEnrollment",

  "upload:courseAsset": "facultyGlobal",

  "billing:administer": "reserved",
  "ai:administer": "reserved",
};

/**
 * Narrows an untrusted role value to a known role.
 *
 * Anything else -- a lowercase variant, a padded string, a non-string that
 * survived an untyped call site -- is not a role, and a principal without a
 * role gets nothing above STUDENT. This is the guard that makes a corrupted or
 * hand-edited `User.role` fail closed instead of open.
 */
export function normalizeRole(value: unknown): Role | null {
  return value === "STUDENT" || value === "FACULTY" || value === "ADMIN"
    ? value
    : null;
}

function isAtLeastFaculty(role: Role): boolean {
  // ADR 0001 section 3: ADMIN implies FACULTY; FACULTY does not imply ADMIN.
  return role === "FACULTY" || role === "ADMIN";
}

/** Does this principal own the resource well enough to author it? */
function ownsForAuthoring(principal: Principal, resource: Resource): boolean {
  switch (resource.kind) {
    case "course":
      return principal.userId === resource.ownerId;
    case "module":
      // Either the Course creator, or the faculty member assigned to this
      // Module. `assignedFacultyId` is nullable, and null must never match a
      // principal whose id is also absent.
      return (
        principal.userId === resource.courseOwnerId ||
        (resource.assignedFacultyId !== null &&
          principal.userId === resource.assignedFacultyId)
      );
    default:
      // An authoring action was asked about a resource that carries no
      // authoring ownership. Deny rather than guess.
      return false;
  }
}

function isAuthor(principal: Principal, resource: Resource): boolean {
  return (
    resource.kind === "authored" &&
    resource.authorId.length > 0 &&
    principal.userId === resource.authorId
  );
}

/**
 * The authorization decision.
 *
 * Returns `false` for every unknown, absent, or contradictory input rather than
 * throwing, so a caller can never accidentally treat a thrown error as a grant.
 */
export function can(
  principal: Principal | null | undefined,
  action: Action,
  resource: Resource = { kind: "global" }
): boolean {
  if (!principal) return false;

  // An empty user id is what an unauthenticated caller produces. It must never
  // match an owner id, including an owner id that is itself empty.
  if (typeof principal.userId !== "string" || principal.userId.length === 0) {
    return false;
  }

  const role = normalizeRole(principal.role);
  if (role === null) return false;

  // `isAction` narrows to the vocabulary, and `RULES` is a total
  // `Record<Action, Rule>`, so the lookup below cannot miss. That totality is
  // enforced by the type system rather than by a runtime guard, which is why
  // there is no undefined check here: adding an action without a rule fails to
  // compile.
  if (!isAction(action)) return false;
  const rule = RULES[action];

  switch (rule) {
    case "adminOnly":
      return role === "ADMIN";

    case "facultyGlobal":
      return isAtLeastFaculty(role);

    case "facultyOwned":
      return isAtLeastFaculty(role) && ownsForAuthoring(principal, resource);

    case "authorOrModerator":
      if (role === "ADMIN") return true;
      return isAuthor(principal, resource);

    case "authorOnly":
      return isAuthor(principal, resource);

    case "activeEnrollment":
      // Entitlement in full is ADR 0002 / #48. What this rule owns is the
      // narrower invariant that a suspended learner loses access.
      return (
        resource.kind === "enrollment" &&
        (resource.status === "ACTIVE" || resource.status === "COMPLETED")
      );

    case "reserved":
      return false;
  }
}
