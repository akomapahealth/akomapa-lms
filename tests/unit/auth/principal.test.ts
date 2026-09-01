import { beforeEach, describe, expect, it, vi } from "vitest";

import { dbMock } from "../support/db";

const clerkAuth = vi.hoisted(() => vi.fn());
vi.mock("@clerk/nextjs/server", () => ({ auth: clerkAuth }));
vi.mock("@/lib/db", async () => ({ db: (await import("../support/db")).dbMock }));

const { getPrincipal, requirePrincipal } = await import("@/lib/auth/principal");
const { Denied } = await import("@/lib/auth/errors");

/**
 * Principal derivation is the one place identity enters the application
 * (ADR 0001 section 1). Every test here is about what happens when the session
 * or the stored role is something other than the happy path, because those are
 * the states that decide whether a corrupted row becomes a privilege.
 */
function signedInAs(userId: string | null) {
  clerkAuth.mockResolvedValue({ userId });
}

beforeEach(() => {
  signedInAs("user_1");
});

describe("getPrincipal", () => {
  it("pairs the Clerk user id with the role stored on the User row", async () => {
    dbMock.user.findUnique.mockResolvedValue({ role: "FACULTY" });

    await expect(getPrincipal()).resolves.toEqual({
      userId: "user_1",
      role: "FACULTY",
    });
  });

  it("returns no principal when there is no session", async () => {
    signedInAs(null);

    await expect(getPrincipal()).resolves.toBeNull();
    // The database must not be consulted for an anonymous caller.
    expect(dbMock.user.findUnique).not.toHaveBeenCalled();
  });

  it("selects only the role for the session's own user", async () => {
    dbMock.user.findUnique.mockResolvedValue({ role: "ADMIN" });

    await getPrincipal();

    expect(dbMock.user.findUnique).toHaveBeenCalledWith({
      where: { id: "user_1" },
      select: { role: true },
    });
  });

  it("falls back to STUDENT when the User row does not exist yet", async () => {
    // Real state: the Clerk webhook that creates the row may not have landed.
    // A new learner must still be able to use the product.
    dbMock.user.findUnique.mockResolvedValue(null);

    await expect(getPrincipal()).resolves.toEqual({
      userId: "user_1",
      role: "STUDENT",
    });
  });

  it("never derives a role above STUDENT from a corrupted row", async () => {
    for (const corrupt of ["admin", "Admin", "SUPERUSER", " ADMIN ", "", null, 1, true, {}, []]) {
      dbMock.user.findUnique.mockResolvedValue({ role: corrupt });

      await expect(getPrincipal()).resolves.toEqual({
        userId: "user_1",
        role: "STUDENT",
      });
    }
  });

  it("propagates a database failure instead of assuming a role", async () => {
    dbMock.user.findUnique.mockRejectedValue(new Error("connection reset"));

    // Swallowing this and returning STUDENT would turn an outage into a silent
    // authorization decision that happens to look like a working product.
    await expect(getPrincipal()).rejects.toThrow("connection reset");
  });
});

describe("requirePrincipal", () => {
  it("returns the principal when there is a session", async () => {
    dbMock.user.findUnique.mockResolvedValue({ role: "ADMIN" });

    await expect(requirePrincipal()).resolves.toEqual({
      userId: "user_1",
      role: "ADMIN",
    });
  });

  it("denies as unauthenticated when there is no session", async () => {
    signedInAs(null);

    await expect(requirePrincipal()).rejects.toBeInstanceOf(Denied);
    await expect(requirePrincipal()).rejects.toMatchObject({
      reason: "unauthenticated",
    });
  });
});
