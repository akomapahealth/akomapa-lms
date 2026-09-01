import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import { Pool } from "pg";

/**
 * The Prisma client the integration suite talks to.
 *
 * A real client against a real database, built the same way `lib/db.ts` builds
 * the production one -- a `pg` pool behind the Prisma driver adapter -- so the
 * suite exercises the same stack, including anything that behaves differently
 * under pooling. That matters for #43, where the whole point is that a pooled
 * connection must not carry a principal between requests.
 */
let pool: Pool | undefined;
let client: PrismaClient | undefined;
let url: string | undefined;

export async function connectTestDatabase(connectionString: string) {
  url = connectionString;
  pool = new Pool({ connectionString });
  client = new PrismaClient({ adapter: new PrismaPg(pool) });
  await client.$queryRaw`SELECT 1`;
}

export function testDb(): PrismaClient {
  if (!client) {
    throw new Error(
      "The test database is not connected. Integration tests must run under " +
        "vitest.integration.config.mts, which installs the setup file."
    );
  }
  return client;
}

/**
 * The connection string in use, for tests that need to open a second
 * connection as a different role. Asking the server for its own host and port
 * does not work: `inet_server_port()` is null over a unix socket, and the
 * answer would be the server's view rather than the client's route to it.
 */
export function testConnectionString(): string {
  if (!url) throw new Error("The test database is not connected.");
  return url;
}

/** The raw pool, for statements Prisma cannot express. */
export function testPool(): Pool {
  if (!pool) throw new Error("The test database is not connected.");
  return pool;
}

/**
 * Empties every table between tests.
 *
 * Discovered from the catalogue rather than listed by hand, so a new model
 * cannot quietly start leaking rows between tests. `_prisma_migrations` is
 * preserved: dropping it would make the database look unmigrated.
 */
export async function truncateAll() {
  const rows = await testDb().$queryRaw<{ tablename: string }[]>`
    SELECT tablename
      FROM pg_tables
     WHERE schemaname = 'public'
       AND tablename <> '_prisma_migrations'
  `;

  if (rows.length === 0) return;

  const tables = rows.map((row) => `"public"."${row.tablename}"`).join(", ");
  await testDb().$executeRawUnsafe(
    `TRUNCATE TABLE ${tables} RESTART IDENTITY CASCADE`
  );
}

export async function closeTestDatabase() {
  await client?.$disconnect();
  await pool?.end();
  client = undefined;
  pool = undefined;
}
