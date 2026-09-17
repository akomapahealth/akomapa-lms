import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { Client } from "pg";

import { testConnectionString, testPool } from "./support/db";

/**
 * The two-role model from ADR 0003, exercised against a real cluster.
 *
 * Roles are cluster-wide rather than per-database, so these tests create their
 * own uniquely named pair and drop it again. Using the production names would
 * leak state between workers and into the developer's own cluster.
 *
 * Nothing here enables row-level security on the application's tables -- that
 * is a later phase of #43. What it proves is that the role separation works,
 * so that when policies do arrive they will actually apply.
 */
const suffix = `${process.env.VITEST_WORKER_ID ?? "0"}_${process.pid}`;
const APP_ROLE = `akomapa_t_app_${suffix}`;
const MIGRATE_ROLE = `akomapa_t_migrate_${suffix}`;
const PASSWORD = "test_only_password";

let database: string;
let host: string;
let port: number;

async function asSuperuser<T>(fn: (client: Client) => Promise<T>): Promise<T> {
  const client = await testPool().connect();
  try {
    return await fn(client as unknown as Client);
  } finally {
    client.release();
  }
}

/** Connects as one of the created roles, to the same test database. */
async function connectAs(role: string): Promise<Client> {
  const client = new Client({
    host,
    port,
    database,
    user: role,
    password: PASSWORD,
  });
  await client.connect();
  return client;
}

beforeEach(async () => {
  const parsed = new URL(testConnectionString());
  database = parsed.pathname.replace(/^\//, "");
  host = parsed.hostname;
  port = Number(parsed.port || 5432);

  await asSuperuser(async (client) => {
    // The same shape as scripts/sql/create-database-roles.sql, with test names.
    await client.query(`CREATE ROLE ${MIGRATE_ROLE} LOGIN PASSWORD '${PASSWORD}'`);
    await client.query(`CREATE ROLE ${APP_ROLE} LOGIN PASSWORD '${PASSWORD}'`);
    await client.query(`ALTER ROLE ${MIGRATE_ROLE} NOSUPERUSER NOBYPASSRLS`);
    await client.query(`ALTER ROLE ${APP_ROLE} NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE`);
    await client.query(`GRANT USAGE ON SCHEMA public TO ${APP_ROLE}, ${MIGRATE_ROLE}`);
    await client.query(`GRANT CREATE ON SCHEMA public TO ${MIGRATE_ROLE}`);
    await client.query(`REVOKE CREATE ON SCHEMA public FROM ${APP_ROLE}`);
    await client.query(
      `GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO ${APP_ROLE}`
    );
    await client.query(
      `GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO ${APP_ROLE}`
    );
  });
});

afterEach(async () => {
  await asSuperuser(async (client) => {
    for (const role of [APP_ROLE, MIGRATE_ROLE]) {
      await client.query(`REASSIGN OWNED BY ${role} TO CURRENT_USER`).catch(() => {});
      await client.query(`DROP OWNED BY ${role}`).catch(() => {});
      await client.query(`DROP ROLE IF EXISTS ${role}`).catch(() => {});
    }
  });
});

describe("role attributes", () => {
  it("gives neither role the ability to ignore row-level security", async () => {
    const rows = await asSuperuser(async (client) => {
      const result = await client.query<{
        rolname: string;
        rolsuper: boolean;
        rolbypassrls: boolean;
      }>(
        `SELECT rolname, rolsuper, rolbypassrls FROM pg_roles
          WHERE rolname IN ($1, $2) ORDER BY rolname`,
        [APP_ROLE, MIGRATE_ROLE]
      );
      return result.rows;
    });

    expect(rows).toHaveLength(2);
    for (const row of rows) {
      // A superuser ignores policies whatever rolbypassrls says, so both
      // attributes have to be false, not just the obvious one.
      expect(row.rolsuper).toBe(false);
      expect(row.rolbypassrls).toBe(false);
    }
  });

  it("lets the application read and write data", async () => {
    const app = await connectAs(APP_ROLE);
    try {
      await app.query(
        `INSERT INTO "User" (id, email, role, "createdAt", "updatedAt")
         VALUES ('user_role_test', 'r@example.test', 'STUDENT', now(), now())`
      );
      const { rows } = await app.query(`SELECT id FROM "User"`);
      expect(rows).toHaveLength(1);
    } finally {
      await app.end();
    }
  });

  it("does not let the application change the schema", async () => {
    const app = await connectAs(APP_ROLE);
    try {
      // The application has no reason to create objects, and an object's owner
      // bypasses that object's policies.
      await expect(app.query(`CREATE TABLE should_not_exist (id text)`)).rejects.toThrow(
        /permission denied/i
      );
    } finally {
      await app.end();
    }
  });

  it("does not let the application truncate, which policies cannot restrain", async () => {
    const app = await connectAs(APP_ROLE);
    try {
      await expect(app.query(`TRUNCATE TABLE "User"`)).rejects.toThrow(/permission denied/i);
    } finally {
      await app.end();
    }
  });
});

describe("row-level security actually applies to the application role", () => {
  beforeEach(async () => {
    await asSuperuser(async (client) => {
      await client.query(`CREATE TABLE rls_probe (id text PRIMARY KEY, owner text NOT NULL)`);
      await client.query(`INSERT INTO rls_probe VALUES ('a', 'alice'), ('b', 'bob')`);
      await client.query(`ALTER TABLE rls_probe ENABLE ROW LEVEL SECURITY`);
      await client.query(`ALTER TABLE rls_probe FORCE ROW LEVEL SECURITY`);
      await client.query(
        `CREATE POLICY owner_only ON rls_probe
           USING (owner = current_setting('app.user_id', true))`
      );
      await client.query(`GRANT SELECT ON rls_probe TO ${APP_ROLE}`);
    });
  });

  afterEach(async () => {
    await asSuperuser((client) => client.query(`DROP TABLE IF EXISTS rls_probe`));
  });

  it("returns only the rows the transaction-scoped principal owns", async () => {
    const app = await connectAs(APP_ROLE);
    try {
      await app.query("BEGIN");
      // set_config with is_local => true dies with the transaction, which is
      // what makes this safe on a pooled connection (ADR 0003 section 2).
      await app.query(`SELECT set_config('app.user_id', 'alice', true)`);
      const { rows } = await app.query(`SELECT id FROM rls_probe`);
      await app.query("COMMIT");

      expect(rows.map((r) => r.id)).toEqual(["a"]);
    } finally {
      await app.end();
    }
  });

  it("returns nothing when no principal is set", async () => {
    // The failure mode ADR 0003 warns about: a missing principal looks like
    // missing data, not like an error.
    const app = await connectAs(APP_ROLE);
    try {
      const { rows } = await app.query(`SELECT id FROM rls_probe`);
      expect(rows).toHaveLength(0);
    } finally {
      await app.end();
    }
  });

  it("does not leak the principal to the next transaction on the same connection", async () => {
    // The specific failure the transaction-scoped design exists to prevent.
    const app = await connectAs(APP_ROLE);
    try {
      await app.query("BEGIN");
      await app.query(`SELECT set_config('app.user_id', 'alice', true)`);
      await app.query("COMMIT");

      const { rows } = await app.query(`SELECT id FROM rls_probe`);
      expect(rows).toHaveLength(0);
    } finally {
      await app.end();
    }
  });

  it("is ignored by a superuser, which is why the runtime role must not be one", async () => {
    const rows = await asSuperuser(async (client) => {
      const result = await client.query(`SELECT id FROM rls_probe`);
      return result.rows;
    });

    // Both rows, no policy applied, no principal set. This is what a
    // misconfigured DATABASE_URL buys: everything, quietly.
    expect(rows).toHaveLength(2);
  });
});
