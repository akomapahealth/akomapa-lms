/**
 * Reports what DATABASE_URL and DIRECT_URL can do, and fails if the runtime
 * role could ignore row-level security.
 *
 * ADR 0003 makes RLS the second enforcement layer. A second layer that is
 * silently not enforcing is worse than none, because it invites the first to be
 * trusted less -- and the failure is quiet: a bypassing role returns *more*
 * rows, which looks like the application working.
 *
 *   npm run db:roles
 *
 * Intended as a deploy step until #103 provides a readiness endpoint to mount
 * `assertRuntimeRoleCannotBypassRls` on.
 */
import { config } from "dotenv";
import { Client } from "pg";

// An exported value beats the dotenv files, so aiming this at production is one
// shell prefix. `.env.local` is loaded with override, so the shell value has to
// be captured first or it is silently discarded.
const explicit = {
  DATABASE_URL: process.env.DATABASE_URL,
  DIRECT_URL: process.env.DIRECT_URL,
};

config();
config({ path: ".env.local", override: true });

for (const [key, value] of Object.entries(explicit)) {
  if (value) process.env[key] = value;
}

interface Capabilities {
  role: string;
  isSuperuser: boolean;
  hasBypassRls: boolean;
  canCreate: boolean;
}

function describeTarget(url: string): string {
  try {
    const parsed = new URL(url);
    return `${parsed.host}${parsed.pathname}`;
  } catch {
    return "(unparseable)";
  }
}

async function inspect(connectionString: string): Promise<Capabilities> {
  const client = new Client({ connectionString });
  await client.connect();

  try {
    const { rows } = await client.query<{
      role: string;
      rolsuper: boolean;
      rolbypassrls: boolean;
      can_create: boolean;
    }>(`
      SELECT rolname AS role, rolsuper, rolbypassrls,
             has_schema_privilege(current_user, 'public', 'CREATE') AS can_create
        FROM pg_roles WHERE rolname = current_user
    `);

    const row = rows[0];
    return {
      role: row.role,
      isSuperuser: row.rolsuper,
      hasBypassRls: row.rolbypassrls,
      canCreate: row.can_create,
    };
  } finally {
    await client.end();
  }
}

function report(label: string, url: string, caps: Capabilities) {
  console.log(`${label}  ${describeTarget(url)}`);
  console.log(`  role         ${caps.role}`);
  console.log(`  superuser    ${caps.isSuperuser}`);
  console.log(`  bypassrls    ${caps.hasBypassRls}`);
  console.log(`  can DDL      ${caps.canCreate}`);
}

async function main() {
  const runtimeUrl = process.env.DATABASE_URL;
  const migrationUrl = process.env.DIRECT_URL;

  if (!runtimeUrl) {
    console.error("DATABASE_URL is not set.");
    process.exitCode = 1;
    return;
  }

  const runtime = await inspect(runtimeUrl);
  report("runtime   (DATABASE_URL)", runtimeUrl, runtime);

  let migration: Capabilities | null = null;
  if (migrationUrl) {
    migration = await inspect(migrationUrl);
    console.log();
    report("migration (DIRECT_URL)  ", migrationUrl, migration);
  }

  console.log();

  const problems: string[] = [];

  if (runtime.isSuperuser || runtime.hasBypassRls) {
    problems.push(
      `the runtime role "${runtime.role}" would ignore row-level security ` +
        `(${runtime.isSuperuser ? "superuser" : "BYPASSRLS"})`
    );
  }

  if (runtime.canCreate) {
    // Not fatal on its own, but the application has no reason to create
    // objects, and an owner bypasses its own table's policies.
    problems.push(
      `the runtime role "${runtime.role}" can create objects in schema public`
    );
  }

  if (!migrationUrl) {
    problems.push(
      "DIRECT_URL is not set, so migrations would run as the runtime role"
    );
  } else if (migration && migration.role === runtime.role) {
    problems.push(
      "DIRECT_URL and DATABASE_URL use the same role, so there is no separation"
    );
  }

  if (problems.length > 0) {
    console.error("FAIL");
    for (const problem of problems) console.error(`  - ${problem}`);
    console.error("\nFix: scripts/sql/create-database-roles.sql");
    process.exitCode = 1;
    return;
  }

  console.log("OK: the runtime role is subject to row-level security, and");
  console.log("    migrations run as a separate privileged role.");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : "Unknown error");
  process.exitCode = 1;
});
