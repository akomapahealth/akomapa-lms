import { describe, expect, it } from "vitest";

import {
  CHECK_CONSTRAINTS,
  IMMUTABILITY_FUNCTION,
  IMMUTABLE_COLUMNS,
  immutabilityTrigger,
  ORDERED_TABLES,
  profileIntegrity,
  SINGLE_GROWTH_QUIZ_INDEX,
} from "@/lib/db/integrity";

import { read } from "../support/source-scan";

const MIGRATION = read("prisma/migrations/20261003050000_integrity_constraints/migration.sql");

describe("the integrity migration matches lib/db/integrity.ts", () => {
  it.each(CHECK_CONSTRAINTS.map((c) => [c.name, c] as const))("creates %s", (_name, check) => {
    expect(MIGRATION).toContain(
      `ALTER TABLE "${check.table}" ADD CONSTRAINT "${check.name}" CHECK (${check.condition});`
    );
    // And verifies existing rows against the same condition first.
    expect(MIGRATION).toContain(`FROM "${check.table}" WHERE NOT (${check.condition})`);
  });

  it.each(IMMUTABLE_COLUMNS.map((t) => [t.table, t] as const))("guards %s identifiers", (_t, entry) => {
    expect(MIGRATION).toContain(
      `CREATE TRIGGER "${immutabilityTrigger(entry.table)}" BEFORE UPDATE ON "${entry.table}"\n  FOR EACH ROW EXECUTE FUNCTION ${IMMUTABILITY_FUNCTION}(${entry.columns.map((c) => `'${c}'`).join(", ")});`
    );
  });

  it("creates the shared trigger function once, before the triggers", () => {
    expect(MIGRATION.split(`CREATE FUNCTION ${IMMUTABILITY_FUNCTION}()`)).toHaveLength(2);
    expect(MIGRATION.indexOf("CREATE FUNCTION")).toBeLessThan(MIGRATION.indexOf("CREATE TRIGGER"));
  });

  it("enforces one Pre-Test and one Post-Test per Course", () => {
    expect(MIGRATION).toContain(
      `CREATE UNIQUE INDEX "${SINGLE_GROWTH_QUIZ_INDEX}" ON "Quiz" ("courseId", "type")\n  WHERE "type" IN ('PRE_TEST', 'POST_TEST');`
    );
  });

  it("verifies before it constrains, and repairs nothing", () => {
    const statements = MIGRATION.replace(/--.*$/gm, "");
    expect(statements.indexOf("RAISE EXCEPTION 'integrity_constraints")).toBeLessThan(
      statements.indexOf("ADD CONSTRAINT")
    );
    expect(statements).not.toMatch(/\bUPDATE\s+"/);
    expect(statements).not.toMatch(/\bDELETE\s+FROM/);
  });

  it("gives every rule a reason", () => {
    for (const rule of [...CHECK_CONSTRAINTS, ...IMMUTABLE_COLUMNS]) {
      expect(rule.reason.length).toBeGreaterThan(20);
    }
  });
});

describe("profileIntegrity", () => {
  function database(counts: Record<string, number>) {
    const statements: string[] = [];
    const query = async (sql: string) => {
      statements.push(sql);
      const hit = Object.entries(counts).find(([needle]) => sql.includes(needle));
      return [{ n: String(hit ? hit[1] : 0) }];
    };
    return { query, statements };
  }

  it("reports nothing for a clean database", async () => {
    const { query, statements } = database({});

    expect(await profileIntegrity(query)).toEqual([]);
    expect(statements).toHaveLength(ORDERED_TABLES.length + CHECK_CONSTRAINTS.length + 1);
  });

  it("separates what the migrations repair from what blocks them", async () => {
    const { query } = database({
      'FROM "Chapter" GROUP BY': 2,
      '"passingScore" >= 0': 1,
      'FROM "Quiz" WHERE "type"::text IN': 3,
    });

    expect(await profileIntegrity(query)).toEqual([
      { rule: "Chapter.position", count: 2, effect: "renumbered by the migration" },
      { rule: "Quiz_passingScore_percentage", count: 1, effect: "blocks the migration" },
      { rule: SINGLE_GROWTH_QUIZ_INDEX, count: 3, effect: "blocks the migration" },
    ]);
  });

  it("treats an empty result as zero", async () => {
    expect(await profileIntegrity(async () => [])).toEqual([]);
  });
});
