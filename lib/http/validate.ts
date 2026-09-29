import type { z } from "zod";

import { readJson } from "./body";
import { BODY_BYTES } from "./limits";
import { ApiError, type FieldProblem } from "./problem";

/**
 * Schema validation at the route boundary (#44).
 *
 * Every helper here throws `ApiError` rather than returning a discriminated
 * union, so a handler validates in one line and `handleRouteError` does the
 * mapping. The alternative -- `if (!parsed.success) return new NextResponse(...)`
 * repeated at every boundary -- is what produced forty slightly different error
 * responses.
 */

/**
 * Turns zod issues into field problems.
 *
 * Only the path and the issue code cross the boundary. zod's `message` is
 * written for a developer and can quote both the schema ("expected one of
 * PRE_TEST, POST_TEST") and the submitted value, neither of which belongs in a
 * response to an untrusted caller.
 */
export function toFieldProblems(error: z.ZodError): FieldProblem[] {
  return error.issues.map((issue) => {
    // `unrecognized_keys` is reported against the parent object, so its path
    // alone would not say which key was refused. The keys are the caller's own
    // input, so naming them leaks nothing they did not just send.
    if (issue.code === "unrecognized_keys") {
      const keys = issue.keys.join(",");
      const base = issue.path.join(".");
      return { path: base.length > 0 ? `${base}.${keys}` : keys, code: issue.code };
    }

    return { path: issue.path.join("."), code: issue.code };
  });
}

/**
 * Validates Next.js route params.
 *
 * A bad path segment is `invalid_parameter`, not `validation_failed`: the
 * address is wrong, not the payload. Doing this before anything else is what
 * keeps a non-uuid id out of a database query, which is where it would otherwise
 * become either a slow full scan or a driver-level error surfacing as a 500.
 */
export function parseParams<S extends z.ZodTypeAny>(
  schema: S,
  raw: unknown
): z.output<S> {
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    throw new ApiError("invalid_parameter", { fields: toFieldProblems(parsed.error) });
  }
  return parsed.data;
}

/**
 * Validates the query string.
 *
 * `searchParams` is flattened with `Object.fromEntries`, so a repeated key keeps
 * its last value. Routes that mean to accept a repeated key must read
 * `getAll` themselves; none does today.
 */
export function parseQuery<S extends z.ZodTypeAny>(
  schema: S,
  url: string
): z.output<S> {
  const { searchParams } = new URL(url);
  const parsed = schema.safeParse(Object.fromEntries(searchParams));
  if (!parsed.success) {
    throw new ApiError("invalid_parameter", { fields: toFieldProblems(parsed.error) });
  }
  return parsed.data;
}

/**
 * Reads, bounds, and validates a JSON body.
 *
 * `maxBytes` defaults to the smallest limit. A route carrying rich text or a
 * structured document must raise it explicitly, so the generous limits apply
 * only where someone decided they should.
 */
export async function parseBody<S extends z.ZodTypeAny>(
  schema: S,
  req: Request,
  maxBytes: number = BODY_BYTES.default
): Promise<z.output<S>> {
  const body = await readJson(req, maxBytes);

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    throw new ApiError("validation_failed", { fields: toFieldProblems(parsed.error) });
  }
  return parsed.data;
}
