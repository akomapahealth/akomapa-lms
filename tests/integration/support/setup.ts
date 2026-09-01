import { afterAll, afterEach, beforeAll } from "vitest";

import {
  adminConnectionString,
  TEMPLATE_DATABASE,
  withDatabase,
  workerDatabase,
} from "./database-url";
import { closeTestDatabase, connectTestDatabase, truncateAll } from "./db";

/**
 * One disposable database per worker, cloned from the migrated template.
 *
 * Workers therefore cannot see each other's rows, which is what lets these
 * tests use real tables without coordinating on ids. The clone is a file copy,
 * so the cost of a worker is close to nothing.
 */
const workerId = process.env.VITEST_WORKER_ID ?? "0";
const database = workerDatabase(workerId);

beforeAll(async () => {
  const admin = adminConnectionString();
  const { Client } = await import("pg");

  const maintenance = new Client({ connectionString: withDatabase(admin, "postgres") });
  await maintenance.connect();

  try {
    await maintenance.query(
      `SELECT pg_terminate_backend(pid)
         FROM pg_stat_activity
        WHERE datname = $1 AND pid <> pg_backend_pid()`,
      [database]
    );
    await maintenance.query(`DROP DATABASE IF EXISTS "${database}"`);
    await maintenance.query(
      `CREATE DATABASE "${database}" TEMPLATE "${TEMPLATE_DATABASE}"`
    );
  } finally {
    await maintenance.end();
  }

  await connectTestDatabase(withDatabase(admin, database));
}, 60_000);

afterEach(async () => {
  // Truncate rather than re-clone: it is far faster, and every test declares
  // the rows it needs, so leftover state from a neighbour is a bug either way.
  await truncateAll();
});

afterAll(async () => {
  await closeTestDatabase();
});
