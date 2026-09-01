# Database roles

How Akomapa Academy connects to PostgreSQL, and why it uses two roles rather
than one. Implements [ADR 0003](../adr/0003-rls-and-transaction-scoped-principal.md);
owned by [#43](https://github.com/akomapahealth/akomapa-lms/issues/43).

## The two roles

| Role | Used by | Privileges |
| --- | --- | --- |
| `akomapa_migrate` | `prisma migrate deploy`, maintenance | Owns schema `public`, may DDL |
| `akomapa_app` | All runtime traffic | `SELECT`/`INSERT`/`UPDATE`/`DELETE` only |

Neither may be a superuser and neither may hold `BYPASSRLS`. **A superuser
ignores row-level security unconditionally**, whatever `rolbypassrls` says, so
checking only the obvious attribute would pass the configuration most
deployments start from.

Ownership is the subtle half. **A table's owner bypasses that table's policies**
unless the table is set to `FORCE ROW LEVEL SECURITY`. The application must
therefore not own its tables, and keeping migrations under a separate role makes
that true by construction rather than by remembering.

`akomapa_app` deliberately has no `TRUNCATE`: truncation is not subject to
row-level security, so a policy could not restrain it.

## Environment variables

| Variable | Role | Read by |
| --- | --- | --- |
| `DATABASE_URL` | `akomapa_app` | The application at runtime |
| `DIRECT_URL` | `akomapa_migrate` | The Prisma CLI, via `prisma.config.ts` |

`prisma.config.ts` already prefers `DIRECT_URL` and falls back to
`DATABASE_URL`, so `npm run build` — which runs `prisma migrate deploy` — picks
up the privileged role automatically once `DIRECT_URL` is set. **If `DIRECT_URL`
is unset, migrations run as the runtime role and will fail** once that role
loses DDL rights. That is the intended failure: loud, at deploy time.

## Creating the roles

`scripts/sql/create-database-roles.sql` is idempotent and safe to re-run. Set
real passwords first — the file ships placeholders.

Locally, as a superuser:

```
psql "$DATABASE_URL" -f scripts/sql/create-database-roles.sql
```

On a managed provider without a superuser shell (Neon), paste it into the SQL
console. Then update both connection strings.

## Verifying

```
npm run db:roles
```

Reports what each connection string can do and exits non-zero if the runtime
role could ignore row-level security, if it can create objects, or if both URLs
resolve to the same role. Aim it at another environment with a shell prefix:

```
DATABASE_URL="postgresql://..." DIRECT_URL="postgresql://..." npm run db:roles
```

An exported value beats the dotenv files.

`assertRuntimeRoleCannotBypassRls()` in `lib/db/roles.ts` is the same assertion
as a function, ready for the readiness endpoint in
[#103](https://github.com/akomapahealth/akomapa-lms/issues/103). Until that
exists, `npm run db:roles` is a **manual** deploy step — CI has no production
database.

## What this does not do yet

No policies exist and row-level security is not enabled on any table, so this
change alters no behaviour: `akomapa_app` currently sees everything, exactly as
before. Splitting the roles first means the later phases of #43 can enable
policies table by table and have them actually apply.

Order of the remaining phases:

1. **Roles and wiring** — this change.
2. **Transaction wrapper** — every query runs inside a transaction that sets
   `app.user_id` and `app.user_role` with `SET LOCAL`, so a pooled connection
   cannot carry a principal into the next request. 223 call sites.
3. **Policies** — enabled per table, each with a test that fails without it.

Enabling policies before step 2 would make every query return nothing. That is
the ordering constraint the phases exist to respect.
