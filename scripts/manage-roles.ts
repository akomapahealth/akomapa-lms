/**
 * Role administration from the command line.
 *
 * Privilege lives in `User.role` and nothing else grants it. Until #88 ships a
 * role-management UI, this script is the only way to create the first ADMIN --
 * and running it is a required pre-flight before the TEACHER_ID removal in #42
 * reaches production, because a deployment with no ADMIN row cannot be
 * administered and cannot repair itself.
 *
 *   npm run role:grant -- --user user_2abc --role ADMIN
 *   npm run role:list
 *   npm run role:check
 *
 * See docs/permission-matrix.md and docs/adr/0001-identity-authentication-and-rbac.md.
 */
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import { config } from "dotenv";
import { Pool } from "pg";

config();
config({ path: ".env.local", override: true });

const ROLES = ["STUDENT", "FACULTY", "ADMIN"] as const;
type Role = (typeof ROLES)[number];

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  console.error(
    "DATABASE_URL is not set. Add it to .env or .env.local before managing roles."
  );
  process.exit(1);
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

/** Grants a role. Idempotent: re-running with the same values changes nothing. */
async function grant(): Promise<number> {
  const userId = flag("user");
  const role = flag("role");

  if (!userId) {
    console.error("Missing --user <clerkUserId>.");
    return 1;
  }
  if (!isRole(role)) {
    console.error(`Missing or invalid --role. Expected one of: ${ROLES.join(", ")}.`);
    return 1;
  }

  const existing = await database.user.findUnique({
    where: { id: userId },
    select: { role: true },
  });

  if (!existing) {
    // The row is created by the Clerk webhook on first sign-in. Creating one
    // here would invent a user that Clerk does not know about, so refuse.
    console.error(
      `No User row for ${userId}. The user must sign in once so the Clerk ` +
        `webhook creates their record, then re-run this command.`
    );
    return 1;
  }

  if (existing.role === role) {
    console.log(`${userId} already has role ${role}. Nothing to do.`);
    return 0;
  }

  await database.user.update({ where: { id: userId }, data: { role } });
  console.log(`${userId}: ${existing.role} -> ${role}`);
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

const COMMANDS: Record<string, () => Promise<number>> = { grant, list, check };

async function main() {
  const command = process.argv[2];
  const run = command ? COMMANDS[command] : undefined;

  if (!run) {
    console.error(
      `Usage: tsx scripts/manage-roles.ts <${Object.keys(COMMANDS).join("|")}> [options]`
    );
    process.exit(1);
  }

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
