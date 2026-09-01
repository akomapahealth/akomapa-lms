/**
 * Role administration from the command line.
 *
 * Privilege lives in `User.role` and nothing else grants it. Until #88 ships a
 * role-management UI, this script is the only way to create the first ADMIN --
 * and running it is a required pre-flight before the TEACHER_ID removal in #42
 * reaches production, because a deployment with no ADMIN row cannot be
 * administered and cannot repair itself.
 *
 *   npm run role:grant -- --email someone@example.com --role ADMIN
 *   npm run role:grant -- --user user_2abc --role ADMIN
 *   npm run role:find  -- --email someone@example.com
 *   npm run role:list
 *   npm run role:check
 *
 * Prefer --email. Clerk keeps separate user directories for its development and
 * production instances, so the same person has a different user_... id in each.
 * A development id can never match a production User row, and nothing in the id
 * says which instance produced it, so the mistake is silent. Email is stable
 * across both, and the row is already in whichever database this is pointed at.
 *
 * See docs/permission-matrix.md and docs/adr/0001-identity-authentication-and-rbac.md.
 */
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import { config } from "dotenv";
import { Pool } from "pg";

// Precedence: an explicitly exported DATABASE_URL wins over both dotenv files.
//
// This matters more here than in most scripts. `.env.local` is loaded with
// `override: true`, so without capturing the shell value first,
// `DATABASE_URL=<production> npm run role:grant` would be silently redirected
// to the developer's local database -- reporting that an administrator was
// granted in production while granting one in dev, and leaving production with
// nobody who can administer it. That is the exact failure the pre-flight
// exists to prevent, so the shell wins.
const explicitDatabaseUrl = process.env.DATABASE_URL;

config();
config({ path: ".env.local", override: true });

if (explicitDatabaseUrl) {
  process.env.DATABASE_URL = explicitDatabaseUrl;
}

const ROLES = ["STUDENT", "FACULTY", "ADMIN"] as const;
type Role = (typeof ROLES)[number];

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  console.error(
    "DATABASE_URL is not set. Add it to .env or .env.local, or export it for " +
      "this command, before managing roles."
  );
  process.exit(1);
}

/**
 * Names the target database without leaking credentials.
 *
 * Every command prints this before doing anything. Granting an administrator in
 * the wrong environment is silent and hard to notice afterwards, so the operator
 * is shown which database they are about to touch rather than being asked to
 * remember what DATABASE_URL held.
 */
function describeTarget(url: string): string {
  try {
    const parsed = new URL(url);
    const database = parsed.pathname.replace(/^\//, "") || "(default)";
    return `${parsed.host}/${database}${explicitDatabaseUrl ? "  [from shell]" : "  [from .env]"}`;
  } catch {
    return "(unparseable DATABASE_URL)";
  }
}

const pool = new Pool({ connectionString });
const database = new PrismaClient({ adapter: new PrismaPg(pool) });

function flag(name: string): string | undefined {
  const index = process.argv.indexOf(`--${name}`);
  return index === -1 ? undefined : process.argv[index + 1];
}

function isRole(value: string | undefined): value is Role {
  return ROLES.includes(value as Role);
}

/** Resolves the target user from --email or --user. */
async function resolveTarget(): Promise<
  { id: string; role: string } | { error: string }
> {
  const email = flag("email");
  const userId = flag("user");

  if (email && userId) {
    return { error: "Pass either --email or --user, not both." };
  }

  if (email) {
    const user = await database.user.findUnique({
      where: { email },
      select: { id: true, role: true },
    });
    if (!user) {
      return {
        error:
          `No User row with email ${email} in this database. Confirm the ` +
          `target line above is the environment you meant, and that the person ` +
          `has signed in there at least once so the Clerk webhook created ` +
          `their row.`,
      };
    }
    return user;
  }

  if (userId) {
    const user = await database.user.findUnique({
      where: { id: userId },
      select: { id: true, role: true },
    });
    if (!user) {
      // The row is created by the Clerk webhook on first sign-in. Creating one
      // here would invent a user that Clerk does not know about, so refuse. A
      // frequent cause is an id copied from the development Clerk instance,
      // which cannot match a production row.
      return {
        error:
          `No User row for ${userId} in this database. Either the person has ` +
          `not signed in here yet, or this id came from a different Clerk ` +
          `instance -- development and production ids differ. Try --email.`,
      };
    }
    return user;
  }

  return { error: "Missing --email <address> or --user <clerkUserId>." };
}

/** Grants a role. Idempotent: re-running with the same values changes nothing. */
async function grant(): Promise<number> {
  const role = flag("role");

  if (!isRole(role)) {
    console.error(`Missing or invalid --role. Expected one of: ${ROLES.join(", ")}.`);
    return 1;
  }

  const target = await resolveTarget();
  if ("error" in target) {
    console.error(target.error);
    return 1;
  }

  if (target.role === role) {
    console.log(`${target.id} already has role ${role}. Nothing to do.`);
    return 0;
  }

  await database.user.update({ where: { id: target.id }, data: { role } });
  console.log(`${target.id}: ${target.role} -> ${role}`);
  return 0;
}

/** Looks up one user's id and role in the database being targeted. */
async function find(): Promise<number> {
  const target = await resolveTarget();
  if ("error" in target) {
    console.error(target.error);
    return 1;
  }

  console.log(`${target.role.padEnd(7)} ${target.id}`);
  return 0;
}

/** Lists everyone holding privilege. Prints ids and roles, never emails. */
async function list(): Promise<number> {
  const privileged = await database.user.findMany({
    where: { role: { in: ["FACULTY", "ADMIN"] } },
    select: { id: true, role: true },
    orderBy: [{ role: "asc" }, { id: "asc" }],
  });

  if (privileged.length === 0) {
    console.log("No FACULTY or ADMIN users. Administration is unreachable.");
    return 0;
  }

  for (const user of privileged) {
    console.log(`${user.role.padEnd(7)} ${user.id}`);
  }
  return 0;
}

/** Exits non-zero when no ADMIN exists. Intended for a deploy pre-flight. */
async function check(): Promise<number> {
  const admins = await database.user.count({ where: { role: "ADMIN" } });

  if (admins === 0) {
    console.error(
      "FAIL: no user has role ADMIN. Administration would be unreachable and " +
        "cannot be granted from inside the application.\n" +
        "Fix: npm run role:grant -- --user <clerkUserId> --role ADMIN"
    );
    return 1;
  }

  console.log(`OK: ${admins} ADMIN user(s).`);
  return 0;
}

const COMMANDS: Record<string, () => Promise<number>> = { grant, find, list, check };

async function main() {
  const command = process.argv[2];
  const run = command ? COMMANDS[command] : undefined;

  if (!run) {
    console.error(
      `Usage: tsx scripts/manage-roles.ts <${Object.keys(COMMANDS).join("|")}> [options]`
    );
    process.exit(1);
  }

  console.log(`target: ${describeTarget(connectionString!)}`);
  process.exitCode = await run();
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : "Unknown error");
    process.exitCode = 1;
  })
  .finally(async () => {
    await database.$disconnect();
    await pool.end();
  });
