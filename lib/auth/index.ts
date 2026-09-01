/**
 * Centralized authorization (ADR 0001, issue #42).
 *
 * Import from `@/lib/auth` rather than from the individual files, so the
 * surface a handler depends on stays small and the module can be reorganised
 * without touching call sites.
 *
 * The matrix these rules encode is documented in docs/permission-matrix.md.
 */
export { ACTIONS, isAction, type Action } from "./actions";
export {
  can,
  normalizeRole,
  type Principal,
  type Resource,
  type Role,
} from "./policy";
export {
  Denied,
  isDenied,
  toResponse,
  type DenialReason,
} from "./errors";
export { getPrincipal, requirePrincipal } from "./principal";
export {
  authorizeComment,
  authorizeCourse,
  authorizeModuleInCourse,
  authorizePost,
  requireCapability,
} from "./guards";
export {
  getStaffCapabilities,
  NO_STAFF_CAPABILITIES,
  requirePageCapability,
  requirePageCourse,
  type StaffCapabilities,
} from "./page";
export { assertAdminExists, countAdmins } from "./bootstrap";
