import { beforeEach, describe, expect, it, vi } from "vitest";

import { dbMock } from "./support/db";

const clerkAuth = vi.hoisted(() => vi.fn());
vi.mock("@clerk/nextjs/server", () => ({ auth: clerkAuth }));
vi.mock("@/lib/db", async () => ({ db: (await import("./support/db")).dbMock }));

const { getUserRole, isAdmin, isFaculty, isStudent } = await import("@/lib/roles");

/**
 * `lib/roles.ts` is now a deprecated adapter over `lib/auth`, kept only so call
 * sites can migrate incrementally. These tests pin the two properties that
 * matter while it still exists:
 *
 *   1. It answers the same questions it always did, so migrating a call site is
 *      a refactor rather than a behaviour change.
 *   2. TEACHER_ID grants nothing. That is the regression proving ADR 0001
 *      section 6 -- the environment backdoor is removed, not deprecated.
 *
 * The exhaustive matrix lives in tests/unit/auth/policy.test.ts. This file is
 * deleted along with the adapter when the last call site moves.
 */
beforeEach(() => {
  clerkAuth.mockResolvedValue({ userId: "user_1" });
});

describe("the deprecated role adapter", () => {
  it.each([
    ["ADMIN", true, true, false],
    ["FACULTY", false, true, false],
    ["STUDENT", false, false, true],
  ])("resolves %s consistently", async (role, admin, faculty, studentOnly) => {
    dbMock.user.findUnique.mockResolvedValue({ role });

    await expect(getUserRole("user_1")).resolves.toBe(role);
    await expect(isAdmin("user_1")).resolves.toBe(admin);
    await expect(isFaculty("user_1")).resolves.toBe(faculty);
    await expect(isStudent("user_1")).resolves.toBe(studentOnly);
  });

  it("defaults an unknown user to STUDENT", async () => {
    dbMock.user.findUnique.mockResolvedValue(null);

    await expect(getUserRole("user_1")).resolves.toBe("STUDENT");
    await expect(isAdmin("user_1")).resolves.toBe(false);
    await expect(isFaculty("user_1")).resolves.toBe(false);
  });

  it("grants nothing for a role the domain does not define", async () => {
    for (const corrupt of ["admin", "Admin", "SUPERUSER", "", 1, true, {}, []]) {
      dbMock.user.findUnique.mockResolvedValue({ role: corrupt });

      await expect(isAdmin("user_1")).resolves.toBe(false);
      await expect(isFaculty("user_1")).resolves.toBe(false);
    }
  });

  it("grants nothing when there is no session", async () => {
    clerkAuth.mockResolvedValue({ userId: null });

    await expect(isAdmin("user_1")).resolves.toBe(false);
    await expect(isFaculty("user_1")).resolves.toBe(false);
    await expect(isStudent("user_1")).resolves.toBe(false);
    await expect(getUserRole("user_1")).resolves.toBe("STUDENT");
  });

  it("ignores a userId that is not the session's own", async () => {
    // The old signature accepted any userId. A caller passing someone else's id
    // must not receive an answer derived from the session's role.
    dbMock.user.findUnique.mockResolvedValue({ role: "ADMIN" });

    await expect(isAdmin("someone_else")).resolves.toBe(false);
    await expect(getUserRole("someone_else")).resolves.toBe("STUDENT");
  });

  it("propagates a database failure instead of granting access", async () => {
    dbMock.user.findUnique.mockRejectedValue(new Error("connection reset"));

    await expect(isAdmin("user_1")).rejects.toThrow("connection reset");
  });

  describe("TEACHER_ID is retired", () => {
    it("grants nothing when the environment variable matches the caller", async () => {
      // The regression for ADR 0001 section 6. Before #42 this returned ADMIN
      // without consulting the database at all.
      vi.stubEnv("TEACHER_ID", "user_1");
      dbMock.user.findUnique.mockResolvedValue({ role: "STUDENT" });

      await expect(getUserRole("user_1")).resolves.toBe("STUDENT");
      await expect(isAdmin("user_1")).resolves.toBe(false);
      await expect(isFaculty("user_1")).resolves.toBe(false);
    });

    it("consults the database rather than the environment", async () => {
      vi.stubEnv("TEACHER_ID", "user_1");
      dbMock.user.findUnique.mockResolvedValue({ role: "STUDENT" });

      await isAdmin("user_1");

      expect(dbMock.user.findUnique).toHaveBeenCalledWith({
        where: { id: "user_1" },
        select: { role: true },
      });
    });

    it("cannot be exploited with an empty variable and an empty caller", async () => {
      vi.stubEnv("TEACHER_ID", "");
      clerkAuth.mockResolvedValue({ userId: "" });

      await expect(isAdmin("")).resolves.toBe(false);
      await expect(isFaculty("")).resolves.toBe(false);
    });
  });
});
