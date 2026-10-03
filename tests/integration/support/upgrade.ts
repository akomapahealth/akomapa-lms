import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";

import { Client } from "pg";

import { adminConnectionString, withDatabase } from "./database-url";

/**
 * Databases at a past migration, for testing what a migration does to data it
 * did not create (#50, #51).
 *
 * `atMigration(target)` builds a fresh database with every committed migration
 * *before* `target` applied, exactly as production held it, so a test can plant
 * legacy rows and then run `target` over them with `applyMigration`. Prisma
 * applies each migration in a transaction, and so does this.
 *
 * Databases are named `akomapa_integration_upgrade_*`, so global teardown drops
 * any a killed run leaves behind.
 */

const MIGRATIONS = path.resolve(__dirname, "../../../prisma/migrations");

// eslint-disable-next-line security/detect-non-literal-fs-filename -- repository path
export const MIGRATION_NAMES = readdirSync(MIGRATIONS)
  .filter((name) => /^\d{14}_/.test(name))
  .sort();

export function migrationSql(name: string): string {
  // eslint-disable-next-line security/detect-non-literal-fs-filename -- repository path
  return readFileSync(path.join(MIGRATIONS, name, "migration.sql"), "utf8");
}

export async function applyInTransaction(client: Client, sql: string): Promise<void> {
  await client.query("BEGIN");
  try {
    await client.query(sql);
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  }
}

export interface UpgradeDatabase {
  client: Client;
  /** Runs one committed migration's SQL, transactionally. */
  applyMigration(name: string): Promise<void>;
  drop(): Promise<void>;
}

/** A database with every migration before `target` applied. */
export async function atMigration(target: string, suffix: string): Promise<UpgradeDatabase> {
  const index = MIGRATION_NAMES.indexOf(target);
  if (index < 0) throw new Error(`unknown migration ${target}`);

  const admin = adminConnectionString();
  const name = `akomapa_integration_upgrade_${suffix}_${process.env.VITEST_WORKER_ID ?? "0"}`;

  const maintenance = new Client({ connectionString: withDatabase(admin, "postgres") });
  await maintenance.connect();
  await maintenance.query(`DROP DATABASE IF EXISTS "${name}"`);
  await maintenance.query(`CREATE DATABASE "${name}"`);
  await maintenance.end();

  const client = new Client({ connectionString: withDatabase(admin, name) });
  await client.connect();
  for (const migration of MIGRATION_NAMES.slice(0, index)) {
    await applyInTransaction(client, migrationSql(migration));
  }

  return {
    client,
    applyMigration: (migration) => applyInTransaction(client, migrationSql(migration)),
    async drop() {
      await client.end();
      const cleanup = new Client({ connectionString: withDatabase(admin, "postgres") });
      await cleanup.connect();
      await cleanup.query(`DROP DATABASE IF EXISTS "${name}"`);
      await cleanup.end();
    },
  };
}
