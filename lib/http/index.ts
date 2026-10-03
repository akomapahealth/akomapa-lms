/**
 * The HTTP boundary every route handler shares (#44).
 *
 * Import from `@/lib/http` rather than the individual files, so a handler's
 * dependency on this layer stays one line and the modules can be rearranged
 * without touching call sites. Mirrors how `@/lib/auth` is consumed.
 *
 * The response contract is documented in docs/api-errors.md.
 */
export { BODY_BYTES, COUNT, NUMBER, TEXT } from "./limits";
export {
  ApiError,
  CORRELATION_HEADER,
  ERROR_CODES,
  isApiError,
  newCorrelationId,
  problem,
  problemBody,
  statusFor,
  type ErrorCode,
  type FieldProblem,
  type ProblemBody,
} from "./problem";
export { readBoundedText, readJson } from "./body";
export { parseBody, parseParams, parseQuery, toFieldProblems } from "./validate";
export { handleRouteError } from "./route";
export {
  assertTrustedOrigin,
  isUploadThingServerCallback,
  ORIGIN_GUARD_EXEMPTIONS,
} from "./origin";
