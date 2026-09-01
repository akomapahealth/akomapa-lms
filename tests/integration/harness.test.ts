import { describe, expect, it } from "vitest";

import { testDb } from "./support/db";

/**
 * Proves the harness itself before anything relies on it.
 *
 * A test suite that silently runs against an unmigrated or shared database
 * produces confident, meaningless results, so these assertions come first.
 */
describe("the integration database", () => {
  it("is built from the committed migrations, not a schema push", async () => {
    const applied = await testDb().$queryRaw<{ migration_name: string }[]>`
      SELECT migration_name FROM _prisma_migrations WHERE finished_at IS NOT NULL
    `;

    // Every directory under prisma/migrations must have been applied. A schema
    // pushed from schema.prisma would leave this table empty while still
    // producing tables that look correct.
    expect(applied.length).toBeGreaterThanOrEqual(6);
    expect(applied.map((row) => row.migration_name)).toContain(
      "20260609000000_phase1_modules_quizzes_roles"
    );
  });

  it("has no pending migrations", async () => {
    const pending = await testDb().$queryRaw<{ count: bigint }[]>`
      SELECT count(*)::bigint AS count FROM _prisma_migrations WHERE finished_at IS NULL
    `;

    expect(Number(pending[0].count)).toBe(0);
  });

  it("is a disposable database, never the developer's own", async () => {
    const [{ current_database }] = await testDb().$queryRaw<
      { current_database: string }[]
    >`SELECT current_database()`;

    expect(current_database).toMatch(/^akomapa_integration_w/);
  });

  it("starts every test empty", async () => {
    // The truncate in afterEach is what makes tests independent; if it stopped
    // working, tests would pass or fail depending on their order.
    expect(await testDb().user.count()).toBe(0);
    expect(await testDb().course.count()).toBe(0);
  });

  it("persists rows within a test", async () => {
    await testDb().user.create({ data: { id: "user_1", email: "a@example.test" } });

    expect(await testDb().user.count()).toBe(1);
  });

  it("does not carry rows into the next test", async () => {
    // Deliberately paired with the test above: this one fails if truncation
    // regresses, and it is ordered after it.
    expect(await testDb().user.count()).toBe(0);
  });
});
