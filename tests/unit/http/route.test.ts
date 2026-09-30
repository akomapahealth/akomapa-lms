import { beforeEach, describe, expect, it, vi } from "vitest";

import { Denied } from "@/lib/auth/errors";
import { ApiError } from "@/lib/http/problem";
import { handleRouteError } from "@/lib/http/route";

const logError = vi.hoisted(() => vi.fn());
vi.mock("@/lib/logger", () => ({ logError }));

/** A Prisma known-request error, as the driver shapes it. */
function prismaError(code: string) {
  const error = new Error(`\nInvalid \`db.user.create()\` invocation:\n\nUnique constraint failed on the fields: (\`email\`)`);
  error.name = "PrismaClientKnownRequestError";
  Object.assign(error, { code, meta: { target: ["email"] } });
  return error;
}

beforeEach(() => {
  logError.mockClear();
});

/**
 * The single exit point every handler's catch block funnels into. It is what
 * makes the contract in docs/api-errors.md true of all forty at once.
 */
describe("handleRouteError", () => {
  it.each([
    ["unauthenticated", 401],
    ["forbidden", 403],
    ["not_found", 404],
  ] as const)("answers a %s denial with %i", async (reason, status) => {
    const response = handleRouteError("TAG", new Denied(reason, "course:update"));

    expect(response.status).toBe(status);
    await expect(response.json()).resolves.toMatchObject({ error: { code: reason } });
  });

  it("does not log a denial", () => {
    // A wrong-role request is expected traffic, not a fault. Logging every one
    // turns an authorization boundary doing its job into noise.
    handleRouteError("TAG", new Denied("forbidden"));

    expect(logError).not.toHaveBeenCalled();
  });

  it("answers an ApiError with its own code and fields", async () => {
    const fields = [{ path: "title", code: "too_big" }];
    const response = handleRouteError("TAG", new ApiError("validation_failed", { fields }));

    expect(response.status).toBe(422);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: "validation_failed", fields },
    });
  });

  it("preserves the ApiError's correlation id", async () => {
    const error = new ApiError("payload_too_large");
    const response = handleRouteError("TAG", error);

    await expect(response.json()).resolves.toMatchObject({
      error: { correlationId: error.correlationId },
    });
    expect(response.headers.get("x-correlation-id")).toBe(error.correlationId);
  });

  it("does not log a deliberate ApiError", () => {
    // An oversized or malformed request is the caller's problem, not an incident.
    handleRouteError("TAG", new ApiError("malformed_json"));

    expect(logError).not.toHaveBeenCalled();
  });

  it.each([
    ["P2002", 409, "conflict"],
    ["P2025", 404, "not_found"],
    ["P2003", 422, "validation_failed"],
    ["P2000", 422, "validation_failed"],
  ] as const)("maps Prisma %s to %i", async (code, status, expected) => {
    // These used to surface as 500s. A second click on "like" is a conflict, not
    // a server fault, and it should not page anyone.
    const response = handleRouteError("TAG", prismaError(code));

    expect(response.status).toBe(status);
    await expect(response.json()).resolves.toMatchObject({ error: { code: expected } });
  });

  it("never leaks the Prisma message, which names the table and column", async () => {
    const response = handleRouteError("TAG", prismaError("P2002"));
    const text = await response.text();

    expect(text).not.toContain("Unique constraint");
    expect(text).not.toContain("email");
    expect(text).not.toContain("db.user.create");
  });

  it("logs a mapped Prisma failure with the correlation id it returned", async () => {
    const response = handleRouteError("COURSE_ID", prismaError("P2002"));
    const body = await response.json();

    expect(logError).toHaveBeenCalledWith("COURSE_ID", expect.anything(), {
      correlationId: body.error.correlationId,
      prismaCode: "P2002",
    });
  });

  it("treats a Prisma-named error with a non-string code as a fault", async () => {
    // Defensive: the name is the only thing marking it as Prisma's, so a
    // malformed one must not be indexed into the mapping table.
    const error = new Error("odd");
    error.name = "PrismaClientKnownRequestError";
    Object.assign(error, { code: 2002 });

    const response = handleRouteError("TAG", error);

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toMatchObject({ error: { code: "internal" } });
  });

  it("treats an unmapped Prisma code as a fault", async () => {
    const response = handleRouteError("TAG", prismaError("P1001"));

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toMatchObject({ error: { code: "internal" } });
  });

  it.each([
    ["an Error", new Error("connection reset")],
    ["a string", "boom"],
    ["null", null],
    ["undefined", undefined],
    ["a bare object", { code: "P2002" }],
  ])("answers 500 for %s", async (_label, thrown) => {
    // A bare object carrying a `code` must not be mistaken for a Prisma error;
    // the name check is what separates them.
    const response = handleRouteError("TAG", thrown);

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toMatchObject({ error: { code: "internal" } });
  });

  it("logs a fault with the correlation id the client received", async () => {
    // This is the whole purpose of the id: a user reports it, and it finds the
    // log line for their request.
    const response = handleRouteError("QUIZ_SUBMIT", new Error("connection reset"));
    const body = await response.json();

    expect(logError).toHaveBeenCalledWith("QUIZ_SUBMIT", expect.any(Error), {
      correlationId: body.error.correlationId,
    });
    expect(response.headers.get("x-correlation-id")).toBe(body.error.correlationId);
  });

  it("never returns a stack trace", async () => {
    const error = new Error("inner detail");
    const response = handleRouteError("TAG", error);
    const text = await response.text();

    expect(text).not.toContain("inner detail");
    expect(text).not.toContain("route.test");
  });
});
