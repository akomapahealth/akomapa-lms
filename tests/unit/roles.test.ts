import { beforeEach, describe, expect, it, vi } from "vitest";

import { dbMock } from "./support/db";
import { aRoleRow } from "./support/builders";

vi.mock("@/lib/db", async () => ({
  db: (await import("./support/db")).dbMock,
}));

const { getUserRole, isAdmin, isFaculty, isStudent } = await import("@/lib/roles");

/**
 * Authorization is the invariant with the worst failure mode in the product: a
 * wrong answer here exposes another learner's data or hands out privilege. The
 * tests below therefore assert the *deny* direction as carefully as the grant
 * direction, and cover the boundaries between the three roles exhaustively.
 *
 * Related work: #42 replaces this module with a centralized RBAC and ownership
 * module. These tests describe the behaviour that must survive that move.
 */
describe("getUserRole", () => {
  beforeEach(() => {
    delete process.env.TEACHER_ID;
  });

  it("returns the role persisted on the User row", async () => {
    dbMock.user.findUnique.mockResolvedValue(aRoleRow("FACULTY"));

    await expect(getUserRole("user_1")).resolves.toBe("FACULTY");
  });

  it("reads the role for the requested user and selects nothing else", async () => {
    dbMock.user.findUnique.mockResolvedValue(aRoleRow("ADMIN"));

    await getUserRole("user_42");

    expect(dbMock.user.findUnique).toHaveBeenCalledWith({
      where: { id: "user_42" },
      select: { role: true },
    });
  });

  it("defaults an unknown user to STUDENT rather than throwing", async () => {
    dbMock.user.findUnique.mockResolvedValue(null);

    await expect(getUserRole("ghost")).resolves.toBe("STUDENT");
  });

  it("defaults to STUDENT when the row exists but the role is null", async () => {
    dbMock.user.findUnique.mockResolvedValue({ role: null });

    await expect(getUserRole("user_1")).resolves.toBe("STUDENT");
  });

  describe("the TEACHER_ID environment backdoor", () => {
    /**
     * `lib/roles.ts` grants ADMIN to whoever matches `process.env.TEACHER_ID`,
     * bypassing the database entirely. The matrix flags this as the reason row
     * 1.7 is `partial`, and #42 removes it. Until then it is real production
     * behaviour and is pinned here so its removal is a deliberate, visible
     * change rather than an accident.
     */
    it("grants ADMIN on an exact match without consulting the database", async () => {
      vi.stubEnv("TEACHER_ID", "teacher_1");

      await expect(getUserRole("teacher_1")).resolves.toBe("ADMIN");
      expect(dbMock.user.findUnique).not.toHaveBeenCalled();
    });

    it("does not grant ADMIN on a near match", async () => {
      vi.stubEnv("TEACHER_ID", "teacher_1");
      dbMock.user.findUnique.mockResolvedValue(aRoleRow("STUDENT"));

      await expect(getUserRole("teacher_10")).resolves.toBe("STUDENT");
      await expect(getUserRole("Teacher_1")).resolves.toBe("STUDENT");
      await expect(getUserRole(" teacher_1")).resolves.toBe("STUDENT");
    });

    it("does not grant ADMIN to an empty user id when TEACHER_ID is unset", async () => {
      // `undefined === ""` is false, so this must fall through to the database.
      // If the comparison were ever loosened, an anonymous caller would become
      // an administrator on any deployment that forgot to set TEACHER_ID.
      dbMock.user.findUnique.mockResolvedValue(null);

      await expect(getUserRole("")).resolves.toBe("STUDENT");
      expect(dbMock.user.findUnique).toHaveBeenCalled();
    });
  });
});

describe("role predicates", () => {
  const cases: Array<{
    persisted: string | null;
    admin: boolean;
    faculty: boolean;
    student: boolean;
  }> = [
    { persisted: "ADMIN", admin: true, faculty: true, student: false },
    { persisted: "FACULTY", admin: false, faculty: true, student: false },
    { persisted: "STUDENT", admin: false, faculty: false, student: true },
    // Absent or unrecognised state must resolve to the least privilege.
    { persisted: null, admin: false, faculty: false, student: true },
  ];

  for (const { persisted, admin, faculty, student } of cases) {
    it(`resolves ${persisted ?? "an absent user"} to admin=${admin} faculty=${faculty} student=${student}`, async () => {
      dbMock.user.findUnique.mockResolvedValue(aRoleRow(persisted));

      await expect(isAdmin("user_1")).resolves.toBe(admin);
      await expect(isFaculty("user_1")).resolves.toBe(faculty);
      await expect(isStudent("user_1")).resolves.toBe(student);
    });
  }

  it("treats ADMIN as a superset of FACULTY but never of STUDENT", async () => {
    dbMock.user.findUnique.mockResolvedValue(aRoleRow("ADMIN"));

    await expect(isFaculty("user_1")).resolves.toBe(true);
    await expect(isStudent("user_1")).resolves.toBe(false);
  });
});

/**
 * Deliberate fault injection.
 *
 * Coverage percentages prove a line ran, not that it was checked. These cases
 * corrupt the module's only dependency and assert the deny-by-default contract
 * still holds — the property that actually protects learner data.
 */
describe("fault injection at the persistence boundary", () => {
  it("denies privilege for role values the domain does not define", async () => {
    for (const corrupt of ["admin", "Admin", "SUPERUSER", "", "  ADMIN  "]) {
      dbMock.user.findUnique.mockResolvedValue({ role: corrupt });

      await expect(isAdmin("user_1")).resolves.toBe(false);
      await expect(isFaculty("user_1")).resolves.toBe(false);
    }
  });

  it("denies privilege when the role arrives as a non-string", async () => {
    for (const corrupt of [0, 1, true, {}, []]) {
      dbMock.user.findUnique.mockResolvedValue({ role: corrupt });

      await expect(isAdmin("user_1")).resolves.toBe(false);
      await expect(isFaculty("user_1")).resolves.toBe(false);
    }
  });

  it("does not grant ADMIN through type coercion at an untyped call site", async () => {
    // TypeScript types `userId` as a string, but route handlers receive values
    // that TypeScript never checked. If the identity comparison were ever
    // loosened from `===` to `==`, an empty TEACHER_ID plus a coercible caller
    // value (`[]`, `""`) would loosely compare equal and mint an administrator.
    vi.stubEnv("TEACHER_ID", "");
    dbMock.user.findUnique.mockResolvedValue(aRoleRow("STUDENT"));

    for (const coercible of [[], "", 0, false, null, undefined]) {
      await expect(
        isAdmin(coercible as unknown as string)
      ).resolves.toBe(false);
    }
  });

  it("fails closed by propagating a database error instead of granting access", async () => {
    dbMock.user.findUnique.mockRejectedValue(new Error("connection reset"));

    // The caller must see the failure. Swallowing it and returning a default
    // role would turn an outage into a silent authorization decision.
    await expect(isAdmin("user_1")).rejects.toThrow("connection reset");
  });
});
