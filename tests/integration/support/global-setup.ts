import { execFileSync } from "node:child_process";

import { Client } from "pg";

import {
  adminConnectionString,
  databaseOf,
  TEMPLATE_DATABASE,
  withDatabase,
} from "./database-url";

/**
 * Builds the template database once per run.
 *
 * Every migration is applied here and nowhere else; workers clone this. That
 * keeps a run's cost independent of the number of workers, and it means the
 * suite exercises the *committed migrations* rather than a schema pushed from
 * `schema.prisma` -- so a migration that does not apply cleanly fails the build
 * rather than being silently bypassed.
 */
async function connectToMaintenanceDatabase(): Promise<Client> {
  const admin = adminConnectionString();

  // Never connect to the maintenance database we are about to drop.
  const maintenance =
    databaseOf(admin) === TEMPLATE_DATABASE
      ? withDatabase(admin, "postgres")
      : admin;

  const client = new Client({ connectionString: maintenance });
  await client.connect();
  return client;
}

/** Ends every other session on a database, so it can be dropped or cloned. */
async function disconnectOthers(client: Client, database: string) {
  await client.query(
    `SELECT pg_terminate_backend(pid)
       FROM pg_stat_activity
      WHERE datname = $1 AND pid <> pg_backend_pid()`,
    [database]
  );
}

export async function setup() {
  const admin = adminConnectionString();
  const client = await connectToMaintenanceDatabase();

  try {
    await disconnectOthers(client, TEMPLATE_DATABASE);
    // Identifiers cannot be parameterised; TEMPLATE_DATABASE is a constant.
    await client.query(`DROP DATABASE IF EXISTS "${TEMPLATE_DATABASE}"`);
    await client.query(`CREATE DATABASE "${TEMPLATE_DATABASE}"`);
  } finally {
    await client.end();
  }

  const templateUrl = withDatabase(admin, TEMPLATE_DATABASE);

  execFileSync("npx", ["prisma", "migrate", "deploy"], {
    stdio: "inherit",
    env: {
      ...process.env,
      // prisma.config.ts prefers DIRECT_URL, so both are pinned at the
      // template to stop a stray environment variable redirecting migrations
      // at a real database.
      DATABASE_URL: templateUrl,
      DIRECT_URL: templateUrl,
    },
  });
}

export async function teardown() {
  const client = await connectToMaintenanceDatabase();

  try {
    // Drop every database this suite created, including workers whose own
    // teardown did not run because the process was killed.
    const { rows } = await client.query<{ datname: string }>(
      `SELECT datname FROM pg_database WHERE datname LIKE 'akomapa_integration_%'`
    );

    for (const { datname } of rows) {
      await disconnectOthers(client, datname);
      await client.query(`DROP DATABASE IF EXISTS "${datname}"`);
    }
  } finally {
    await client.end();
  }
}
