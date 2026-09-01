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
    ["unauthenticated", 401, "Unauthorized"],
    ["forbidden", 403, "Forbidden"],
    ["not_found", 404, "Not Found"],
  ] as const)("maps %s to %i", async (reason, status, body) => {
    const response = toResponse(new Denied(reason));

    expect(response?.status).toBe(status);
    await expect(response?.text()).resolves.toBe(body);
  });

  it("returns null for anything that is not a denial", () => {
    // A handler's catch block re-raises genuine faults rather than reporting an
    // internal error as a permission problem.
    for (const other of [new Error("connection reset"), null, undefined, "nope"]) {
      expect(toResponse(other)).toBeNull();
    }
  });
});
