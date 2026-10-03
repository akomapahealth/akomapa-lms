/**
 * Preflight for the #51 integrity migrations.
 *
 *   npm run db:integrity:preflight
 *
 * Read-only. Reports parents with duplicate positions (the ordering migration
 * renumbers them, keeping their order), rows outside a CHECK constraint's range,
 * and Courses with more than one Pre-Test or Post-Test (both block the
 * integrity migration until a person resolves them;
 * docs/runbooks/database-integrity.md). After the migrations it always reports
 * nothing: the database refuses those rows.
 *
 * Connection precedence matches the other operator scripts: an exported value
 * beats a dotenv file, and DIRECT_URL beats DATABASE_URL.
 *
 * Exit status: 0 when clean, 1 when something blocks a migration, 2 on error.
 * Duplicate positions alone exit 0: they are repaired, not refused.
 */
import { config } from "dotenv";
import { Client } from "pg";

import { profileIntegrity } from "../lib/db/integrity";

const exported = {
  DIRECT_URL: process.env.DIRECT_URL,
  DATABASE_URL: process.env.DATABASE_URL,
};

config();
config({ path: ".env.local", override: true });

const candidates = [
  ["DIRECT_URL (exported)", exported.DIRECT_URL],
  ["DATABASE_URL (exported)", exported.DATABASE_URL],
  ["DIRECT_URL", process.env.DIRECT_URL],
  ["DATABASE_URL", process.env.DATABASE_URL],
] as const;

async function main(): Promise<number> {
  const chosen = candidates.find(([, value]) => Boolean(value));
  if (!chosen) {
    console.error("No connection string. Set DIRECT_URL or DATABASE_URL.");
    return 2;
  }
  const [source, connectionString] = chosen as [string, string];

  let target = source;
  try {
    const url = new URL(connectionString);
    // Role, host, and database. Never the password.
    target = `${source}  ${url.username}@${url.hostname}${url.pathname}`;
  } catch {
    // Keep the bare source name.
  }

  const client = new Client({ connectionString });
  await client.connect();

  try {
    const findings = await profileIntegrity(async (sql) => (await client.query(sql)).rows);
    console.log(`Database integrity preflight (#51)\nConnection: ${target}\n`);

    if (findings.length === 0) {
      console.log("Verdict: clean. Every migration will apply without changing or refusing a row.");
      return 0;
    }

    for (const { rule, count, effect } of findings) {
      console.log(`  ${rule}: ${count}  (${effect})`);
    }

    const blocking = findings.some((f) => f.effect === "blocks the migration");
    console.log(
      blocking
        ? "\nVerdict: the integrity migration will abort and change nothing. Resolve each row; see docs/runbooks/database-integrity.md."
        : "\nVerdict: deployable. Duplicate positions will be renumbered, keeping their order."
    );
    return blocking ? 1 : 0;
  } finally {
    await client.end();
  }
}

main()
  .then((code) => process.exit(code))
  .catch((error: unknown) => {
    console.error("Preflight failed:", error instanceof Error ? error.message : error);
    process.exit(2);
  });
