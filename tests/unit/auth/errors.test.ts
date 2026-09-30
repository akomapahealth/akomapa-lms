import { describe, expect, it } from "vitest";

import { Denied, isDenied, toResponse } from "@/lib/auth/errors";

/**
 * The three denial reasons exist because collapsing them loses information the
 * client needs. Today every handler answers 401, which makes the web app send a
 * signed-in user to the sign-in page for what is actually a permission error.
 */
describe("Denied", () => {
  it("carries the reason and the action", () => {
    const denied = new Denied("forbidden", "course:update");

    expect(denied.reason).toBe("forbidden");
    expect(denied.action).toBe("course:update");
    expect(denied).toBeInstanceOf(Error);
    expect(denied.name).toBe("Denied");
  });

  it("names the action in the message but never the resource or principal", () => {
    // The message reaches server logs. Ids of resources and people do not
    // belong there.
    expect(new Denied("not_found", "quiz:delete").message).toBe("denied: not_found (quiz:delete)");
    expect(new Denied("unauthenticated").message).toBe("denied: unauthenticated");
  });
});

describe("isDenied", () => {
  it("recognises a denial and nothing else", () => {
    expect(isDenied(new Denied("forbidden"))).toBe(true);
    for (const other of [new Error("boom"), null, undefined, "forbidden", {}, { reason: "forbidden" }]) {
      expect(isDenied(other)).toBe(false);
    }
  });
});

describe("toResponse", () => {
  it.each([
    ["unauthenticated", 401],
    ["forbidden", 403],
    ["not_found", 404],
  ] as const)("maps %s to %i in the shared problem shape", async (reason, status) => {
    const response = toResponse(new Denied(reason));

    expect(response?.status).toBe(status);

    // The body is the one documented shape (docs/api-errors.md), not a bare
    // string: a client has to tell "not signed in" from "not allowed" from
    // "does not exist" without matching on prose.
    const body = await response?.json();
    expect(body.error.code).toBe(reason);
    expect(typeof body.error.message).toBe("string");
    expect(body.error.correlationId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
    );
    // No field list: a denial is not a field-level failure.
    expect(body.error.fields).toBeUndefined();
  });

  it("carries the correlation id in a header as well as the body", async () => {
    // So a person reporting a failure can quote an id without opening devtools.
    const response = toResponse(new Denied("forbidden"));
    const body = await response!.json();

    expect(response!.headers.get("x-correlation-id")).toBe(body.error.correlationId);
  });

  it("never names the action or the resource in the response", async () => {
    // The action reaches the log line via `Denied.message`. It must not reach the
    // client, where it would describe the permission model to someone probing it.
    const response = toResponse(new Denied("forbidden", "course:update"));

    await expect(response!.text()).resolves.not.toContain("course:update");
  });

  it("returns null for anything that is not a denial", () => {
    // A handler's catch block re-raises genuine faults rather than reporting an
    // internal error as a permission problem.
    for (const other of [new Error("connection reset"), null, undefined, "nope"]) {
      expect(toResponse(other)).toBeNull();
    }
  });
});
