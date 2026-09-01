/**
 * Where the integration suite gets its database, and how it names the
 * disposable ones it creates.
 *
 * Kept free of imports so it can be used from Vitest's global setup, from a
 * worker's setup file, and from a plain script without dragging the Prisma
 * client into any of them.
 */

/** The server the suite is allowed to create and drop databases on. */
export function adminConnectionString(): string {
  const url = process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL;

  if (!url) {
    throw new Error(
      "Neither TEST_DATABASE_URL nor DATABASE_URL is set. The integration " +
        "suite needs a PostgreSQL server it may create and drop databases on. " +
        "See docs/agents/testing.md."
    );
  }

  return url;
}

/**
 * The template database: migrated once, then cloned per worker.
 *
 * Applying every migration once per worker is the slow part of an integration
 * suite. `CREATE DATABASE ... TEMPLATE` copies an already-migrated database at
 * file-copy speed, so adding workers costs almost nothing.
 */
export const TEMPLATE_DATABASE = "akomapa_integration_template";

/** One disposable database per Vitest worker, so workers cannot see each other. */
export function workerDatabase(workerId: string): string {
  // Worker ids come from Vitest and are numeric, but this string is
  // interpolated into DDL, so it is constrained rather than trusted.
  const safe = workerId.replace(/[^0-9a-z_]/gi, "").slice(0, 16) || "0";
  return `akomapa_integration_w${safe}`;
}

/** Rewrites a connection string to point at a different database on the same server. */
export function withDatabase(connectionString: string, database: string): string {
  const url = new URL(connectionString);
  url.pathname = `/${database}`;
  return url.toString();
}

/** The database a connection string points at. */
export function databaseOf(connectionString: string): string {
  return new URL(connectionString).pathname.replace(/^\//, "");
}
