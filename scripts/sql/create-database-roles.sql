-- Database roles for Akomapa Academy (ADR 0003, issue #43).
--
-- Two roles, because row-level security only means anything if the role the
-- application runs as cannot ignore it:
--
--   akomapa_migrate  owns the schema and applies migrations. Privileged.
--   akomapa_app      serves runtime traffic. Cannot bypass RLS, owns nothing.
--
-- Ownership is the subtle half. A table's owner bypasses that table's policies
-- unless the table is set to FORCE ROW LEVEL SECURITY, so the application must
-- not own its tables. Keeping migrations under a separate role is what makes
-- that true by construction rather than by remembering.
--
-- Idempotent: safe to re-run, and safe to run before the policies exist.
-- Run it as a superuser (locally) or via the provider's SQL console (Neon).
-- Passwords are placeholders; set real ones before running, and put them in
-- DATABASE_URL (akomapa_app) and DIRECT_URL (akomapa_migrate).

\set ON_ERROR_STOP on

-- ── Roles ────────────────────────────────────────────────────────────────────

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'akomapa_migrate') THEN
    CREATE ROLE akomapa_migrate LOGIN PASSWORD 'CHANGE_ME_MIGRATE';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'akomapa_app') THEN
    CREATE ROLE akomapa_app LOGIN PASSWORD 'CHANGE_ME_APP';
  END IF;
END
$$;

-- Stated explicitly rather than relying on defaults, so re-running this file
-- repairs a role that was altered by hand.
ALTER ROLE akomapa_migrate NOSUPERUSER NOBYPASSRLS CREATEDB;
ALTER ROLE akomapa_app     NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE;

-- ── Schema ownership ─────────────────────────────────────────────────────────

ALTER SCHEMA public OWNER TO akomapa_migrate;

GRANT USAGE ON SCHEMA public TO akomapa_app;
-- The application never creates objects; migrations do.
REVOKE CREATE ON SCHEMA public FROM akomapa_app;
REVOKE CREATE ON SCHEMA public FROM PUBLIC;

-- ── Runtime privileges ───────────────────────────────────────────────────────

-- Data, not structure. No TRUNCATE and no REFERENCES: both are structural, and
-- TRUNCATE is not subject to row-level security.
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO akomapa_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO akomapa_app;

-- The same privileges on anything a future migration creates. Without this,
-- every migration that adds a table would silently break the application until
-- someone remembered to grant it.
ALTER DEFAULT PRIVILEGES FOR ROLE akomapa_migrate IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO akomapa_app;
ALTER DEFAULT PRIVILEGES FOR ROLE akomapa_migrate IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO akomapa_app;

-- ── Verification ─────────────────────────────────────────────────────────────

-- Both roles must report f/f. `npm run db:roles` asserts the same thing against
-- the connection strings the application actually uses.
SELECT rolname, rolsuper, rolbypassrls
  FROM pg_roles
 WHERE rolname IN ('akomapa_app', 'akomapa_migrate')
 ORDER BY rolname;
