/**
 * Preflight for the closed-domain-states migration (#50).
 *
 *   npm run db:states:preflight
 *
 * Read-only. Profiles every column that #50 turns into an enum and lists any
 * value outside its set, with a row count. Run it against production before
 * deploying the migration: if it reports anything, the migration would abort,
 * and each value needs an explicit decision (docs/runbooks/closed-domain-states.md).
 * After the migration it always reports nothing, because the database can no
 * longer store an unexpected value.
 *
 * Connection precedence matches the other operator scripts: an exported value
 * beats a dotenv file, and DIRECT_URL beats DATABASE_URL. Quote the value in
 * single quotes; a `$` in a password is expanded by the shell otherwise.
 *
 * Exit status: 0 when clean, 1 when unexpected values exist, 2 on error.
 */
import { config } from "dotenv";
import { Client } from "pg";

import { CLOSED_STATE_COLUMNS, profileClosedStates } from "../lib/domain/states";

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
    const unexpected = await profileClosedStates(async (sql) => (await client.query(sql)).rows);

    console.log(`Closed domain states preflight (#50)\nConnection: ${target}\n`);
    console.log(`Checked: ${CLOSED_STATE_COLUMNS.map((c) => `${c.table}.${c.column}`).join(", ")}\n`);

    if (unexpected.length === 0) {
      console.log("Verdict: clean. Every value is in its set; the migration will convert all rows.");
      return 0;
    }

    console.log("Unexpected values:");
    for (const { column, value, rows } of unexpected) {
      console.log(`  ${column} = ${value === null ? "NULL" : JSON.stringify(value)}  (${rows} rows)`);
    }
    console.log(
      "\nVerdict: the migration will abort and change nothing. Resolve each value explicitly;" +
        " see docs/runbooks/closed-domain-states.md."
    );
    return 1;
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
