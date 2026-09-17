import "server-only";

import { db } from "@/lib/db";

/**
 * What the database says about the role a connection is using.
 *
 * ADR 0003 makes row-level security the second enforcement layer, and a second
 * layer that silently isn't enforcing is worse than none: it invites the first
 * layer to be trusted less. So the property is checked rather than assumed.
 *
 * The check has to survive being wrong in the quiet direction. A role that can
 * bypass RLS does not error -- it returns *more* rows, which looks like the
 * application working.
 */
export interface RoleCapabilities {
  role: string;
  /** Superusers ignore row-level security unconditionally, flag or no flag. */
  isSuperuser: boolean;
  /** The explicit BYPASSRLS attribute. */
  hasBypassRls: boolean;
}

export async function describeCurrentRole(): Promise<RoleCapabilities> {
  const rows = await db.$queryRaw<
    { role: string; is_superuser: boolean; has_bypass_rls: boolean }[]
  >`
    SELECT rolname       AS role,
           rolsuper      AS is_superuser,
           rolbypassrls  AS has_bypass_rls
      FROM pg_roles
     WHERE rolname = current_user
  `;

  if (rows.length === 0) {
    // current_user always exists in pg_roles; an empty result means the query
    // did not run against the database we think it did.
    throw new Error("Could not resolve the current database role.");
  }

  return {
    role: rows[0].role,
    isSuperuser: rows[0].is_superuser,
    hasBypassRls: rows[0].has_bypass_rls,
  };
}

/** True when this role would ignore row-level security policies. */
export function bypassesRowLevelSecurity(capabilities: RoleCapabilities): boolean {
  // Either attribute is sufficient on its own. Checking only BYPASSRLS would
  // pass a superuser, which is the configuration most deployments start from.
  return capabilities.isSuperuser || capabilities.hasBypassRls;
}

/**
 * Fails if runtime traffic would ignore row-level security.
 *
 * Intended for the readiness check in
 * [#103](https://github.com/akomapahealth/akomapa-lms/issues/103), so a
 * misconfigured environment refuses to serve rather than serving everything.
 * Until that endpoint exists, `npm run db:roles` runs the same assertion as a
 * deploy step.
 */
export async function assertRuntimeRoleCannotBypassRls(): Promise<void> {
  const capabilities = await describeCurrentRole();

  if (bypassesRowLevelSecurity(capabilities)) {
    const reason = capabilities.isSuperuser ? "is a superuser" : "has BYPASSRLS";
    throw new Error(
      `The runtime database role "${capabilities.role}" ${reason}, so row-level ` +
        `security policies would not apply to it. Point DATABASE_URL at the ` +
        `unprivileged application role and keep the privileged role in ` +
        `DIRECT_URL. See scripts/sql/create-database-roles.sql.`
    );
  }
}
