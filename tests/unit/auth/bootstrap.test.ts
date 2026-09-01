import { describe, expect, it, vi } from "vitest";

import { dbMock } from "../support/db";

vi.mock("@/lib/db", async () => ({ db: (await import("../support/db")).dbMock }));

const { assertAdminExists, countAdmins } = await import("@/lib/auth/bootstrap");

/**
 * The invariant that makes retiring TEACHER_ID safe.
 *
 * Privilege now comes only from `User.role`, and role management is #88, which
 * does not exist yet. A deployment that reaches production with no ADMIN row
 * cannot be administered and cannot repair itself from inside the application,
 * so the count is checked explicitly rather than assumed.
 */
describe("countAdmins", () => {
  it("counts users holding the ADMIN role", async () => {
    dbMock.user.count.mockResolvedValue(2);

    await expect(countAdmins()).resolves.toBe(2);
    expect(dbMock.user.count).toHaveBeenCalledWith({ where: { role: "ADMIN" } });
  });
});

describe("assertAdminExists", () => {
  it("passes when at least one ADMIN exists", async () => {
    dbMock.user.count.mockResolvedValue(1);

    await expect(assertAdminExists()).resolves.toBeUndefined();
  });

  it("fails loudly when there are none, and names the remedy", async () => {
    dbMock.user.count.mockResolvedValue(0);

    // The error text is the runbook. Whoever hits this is locked out and needs
    // the exact command, not a description of the problem.
    await expect(assertAdminExists()).rejects.toThrow(/no user has role ADMIN/i);
    await expect(assertAdminExists()).rejects.toThrow(/npm run role:grant/);
  });
});
