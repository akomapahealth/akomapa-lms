import { describe, expect, it, vi } from "vitest";

import { dbMock } from "../support/db";

vi.mock("@/lib/db", async () => ({ db: (await import("../support/db")).dbMock }));

const { assertRuntimeRoleCannotBypassRls, bypassesRowLevelSecurity, describeCurrentRole } =
  await import("@/lib/db/roles");

/**
 * The guard that stops row-level security from being silently absent.
 *
 * A bypassing role does not error. It returns *more* rows, which looks exactly
 * like the application working, so the condition has to be asserted rather than
 * noticed.
 */
/**
 * Resolved per call, not captured once: the shared double is rebuilt before
 * every test, so a reference taken at module scope points at a stale mock.
 */
const queryRaw = () =>
  dbMock.$queryRaw as unknown as { mockResolvedValue: (value: unknown) => void };

function roleIs(overrides: { rolsuper?: boolean; rolbypassrls?: boolean } = {}) {
  queryRaw().mockResolvedValue([
    {
      role: "akomapa_app",
      is_superuser: overrides.rolsuper ?? false,
      has_bypass_rls: overrides.rolbypassrls ?? false,
    },
  ]);
}

describe("bypassesRowLevelSecurity", () => {
  it("is false only when the role is neither superuser nor BYPASSRLS", () => {
    expect(
      bypassesRowLevelSecurity({ role: "a", isSuperuser: false, hasBypassRls: false })
    ).toBe(false);
  });

  it("is true for a superuser even without the BYPASSRLS attribute", () => {
    // The configuration most deployments start from. Checking only
    // rolbypassrls would pass it.
    expect(
      bypassesRowLevelSecurity({ role: "postgres", isSuperuser: true, hasBypassRls: false })
    ).toBe(true);
  });

  it("is true for BYPASSRLS without superuser", () => {
    expect(
      bypassesRowLevelSecurity({ role: "a", isSuperuser: false, hasBypassRls: true })
    ).toBe(true);
  });
});

describe("describeCurrentRole", () => {
  it("reports what the database says about the connected role", async () => {
    roleIs({ rolbypassrls: true });

    await expect(describeCurrentRole()).resolves.toEqual({
      role: "akomapa_app",
      isSuperuser: false,
      hasBypassRls: true,
    });
  });

  it("fails rather than assuming when the role cannot be resolved", async () => {
    // current_user is always in pg_roles, so an empty result means the query
    // did not run where we think it did.
    queryRaw().mockResolvedValue([]);

    await expect(describeCurrentRole()).rejects.toThrow(/could not resolve/i);
  });
});

describe("assertRuntimeRoleCannotBypassRls", () => {
  it("passes for an unprivileged role", async () => {
    roleIs();

    await expect(assertRuntimeRoleCannotBypassRls()).resolves.toBeUndefined();
  });

  it("fails for a superuser and says which attribute is at fault", async () => {
    roleIs({ rolsuper: true });

    await expect(assertRuntimeRoleCannotBypassRls()).rejects.toThrow(/is a superuser/);
  });

  it("fails for BYPASSRLS and says so", async () => {
    roleIs({ rolbypassrls: true });

    await expect(assertRuntimeRoleCannotBypassRls()).rejects.toThrow(/has BYPASSRLS/);
  });

  it("names the remedy, since whoever hits this needs the fix not the diagnosis", async () => {
    roleIs({ rolsuper: true });

    await expect(assertRuntimeRoleCannotBypassRls()).rejects.toThrow(/DATABASE_URL/);
    await expect(assertRuntimeRoleCannotBypassRls()).rejects.toThrow(
      /create-database-roles\.sql/
    );
  });
});
