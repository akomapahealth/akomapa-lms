import type { NextResponse } from "next/server";

import { isDenied } from "@/lib/auth/errors";
import { logError } from "@/lib/logger";

import {
  ApiError,
  type ErrorCode,
  isApiError,
  newCorrelationId,
  problem,
} from "./problem";

/**
 * The single exit point for a failed request (#44).
 *
 * Every handler's catch block is one call to `handleRouteError`. That is what
 * makes the contract in docs/api-errors.md true of all of them at once: there is
 * no second place that decides a status or writes a body.
 */

/**
 * Prisma's known request errors, recognised without importing the client.
 *
 * Duck-typing keeps this module out of the generated client's import graph, so
 * a unit test that mocks `@/lib/db` does not have to load Prisma to assert on an
 * error mapping. The shape is stable across Prisma majors.
 */
function prismaErrorCode(error: unknown): string | null {
  if (typeof error !== "object" || error === null) return null;
  const candidate = error as { name?: unknown; code?: unknown };
  if (candidate.name !== "PrismaClientKnownRequestError") return null;
  return typeof candidate.code === "string" ? candidate.code : null;
}

/**
 * Database constraint failures that are really client errors.
 *
 * Without this they surfaced as 500s, which is both wrong and misleading: a
 * second click on "like" is a conflict, not a server fault, and it should not
 * page anyone.
 */
const PRISMA_CODES: Record<string, ErrorCode> = {
  // Unique constraint violated: the row already exists.
  P2002: "conflict",
  // A required related record was not found.
  P2025: "not_found",
  // Foreign key constraint failed: the body referenced something absent.
  P2003: "validation_failed",
  // Value too long for the column.
  P2000: "validation_failed",
};

/**
 * Maps any thrown value to a response.
 *
 * Order matters. Deliberate failures -- denials and `ApiError` -- are answered
 * as themselves. Anything left is a fault: it is logged with the correlation id
 * the client receives, and answered with a bare 500 that describes nothing.
 *
 * @param tag Stable log tag for this route, e.g. `COURSE_ID_PATCH`.
 */
export function handleRouteError(tag: string, error: unknown): NextResponse {
  if (isDenied(error)) {
    return problem(error.reason);
  }

  if (isApiError(error)) {
    return problem(error.code, {
      fields: error.fields,
      correlationId: error.correlationId,
    });
  }

  const prismaCode = prismaErrorCode(error);
  if (prismaCode !== null) {
    const mapped = PRISMA_CODES[prismaCode];
    if (mapped !== undefined) {
      // No fields: the constraint name would describe the schema.
      const correlationId = newCorrelationId();
      logError(tag, error, { correlationId, prismaCode });
      return problem(mapped, { correlationId });
    }
  }

  const correlationId = newCorrelationId();
  logError(tag, error, { correlationId });
  return problem("internal", { correlationId });
}

/** Re-exported so a handler imports its whole error vocabulary from one path. */
export { ApiError, problem };
