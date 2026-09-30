/**
 * Reports disagreements between Purchase and Enrollment (#48, ADR 0002).
 *
 * Read-only by default. ADR 0002 requires that existing purchases are reconciled
 * to Enrollment idempotently and that discrepancies are reportable before
 * cutover; this is the reporting half. The backfill itself is the migration
 * `20260930000000_backfill_enrollments_from_purchases`, which runs with the
 * deploy. This script is how an operator checks the result, and how they find the
 * cases a blanket backfill deliberately does not touch.
 *
 *   npm run entitlement:reconcile          # report only
 *   npm run entitlement:reconcile -- --fix # create the missing Enrollments
 *
 * Reads `DIRECT_URL` in preference to `DATABASE_URL`, the same way
 * `prisma.config.ts` does, because after #43 `DATABASE_URL` is the non-bypass
 * runtime role. Quote the value in single quotes: a password containing `$` is
 * expanded by the shell inside double quotes, which presents as an
 * authentication failure.
 *
 * `--fix` is idempotent and only ever creates an Enrollment for a Purchase that
 * has none. It never changes an existing status: a SUSPENDED or COMPLETED learner
 * must not be reset to ACTIVE by a reconciliation run. Access removal is a status
 * change, never a deletion.
 */
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import { config } from "dotenv";
import { Pool } from "pg";

import { ENROLLMENT_STATUSES } from "../lib/entitlement/types";

// Precedence, most explicit first. Both halves matter:
//
//   1. An exported value beats a dotenv file. `.env.local` is loaded with
//      `override: true` so it beats `.env`, which would otherwise clobber a
//      connection string passed on the command line -- silently reconciling the
//      local database while the report claims otherwise.
//   2. DIRECT_URL beats DATABASE_URL, mirroring `prisma.config.ts`, because after
//      #43 DATABASE_URL is the non-bypass runtime role.
//
// Rule 1 has to outrank rule 2. Preferring a *file* DIRECT_URL over an *exported*
// DATABASE_URL is how `DATABASE_URL='<production>' npm run entitlement:reconcile`
// ends up reading a developer's local database.
const exported = {
  DIRECT_URL: process.env.DIRECT_URL,
  DATABASE_URL: process.env.DATABASE_URL,
};

config();
config({ path: ".env.local", override: true });

const candidates = [
  ["DIRECT_URL (exported)", exported.DIRECT_URL],
  ["DATABASE_URL (exported)", exported.DATABASE_URL],
  ["DIRECT_URL", process.env.DIRECT_URL],
  ["DATABASE_URL", process.env.DATABASE_URL],
] as const;

const chosen = candidates.find(([, value]) => Boolean(value));

if (!chosen) {
  console.error(
    "No connection string. Set DIRECT_URL or DATABASE_URL. This script reads " +
      "Purchase and Enrollment, so it needs a role with privileges on both -- the " +
      "migration role, not the runtime role."
  );
  process.exit(1);
}

const [connectionSource, connectionString] = chosen as [string, string];

/** Which connection was used, so a surprising report can be attributed. */
function describeConnection(): string {
  try {
    const url = new URL(connectionString);
    // Role, host, and database. Never the password.
    return `${connectionSource}  ${url.username}@${url.hostname}${url.pathname}`;
  } catch {
    return connectionSource;
  }
}

const db = new PrismaClient({ adapter: new PrismaPg(new Pool({ connectionString })) });

const FIX = process.argv.includes("--fix");

async function main() {
  // Context counts. "Purchase is empty" and "this database is empty" look
  // identical in a report and mean opposite things: the first is nothing to
  // reconcile, the second is the wrong connection. Users and Courses tell them
  // apart, and both tables existing at all is already proved by these reads not
  // raising 42P01.
  const [users, courses, purchases, enrollments] = await Promise.all([
    db.user.count(),
    db.course.count(),
    db.purchase.findMany({
      select: { userId: true, courseId: true, createdAt: true },
      orderBy: { createdAt: "asc" },
    }),
    db.enrollment.findMany({ select: { userId: true, courseId: true, status: true } }),
  ]);

  const key = (row: { userId: string; courseId: string }) => `${row.userId} ${row.courseId}`;
  const byKey = new Map(enrollments.map((e) => [key(e), e]));
  const purchaseKeys = new Set(purchases.map(key));

  // 1. Paid, but no Enrollment. These are the learners who would be locked out of
  //    a Course they bought, once Enrollment became canonical.
  const missing = purchases.filter((p) => !byKey.has(key(p)));

  // 2. Paid, and suspended. Not a fault -- a refund or a moderation action looks
  //    exactly like this -- but an operator should see it, because before #48 the
  //    Purchase was still granting access and now it is not.
  const suspended = purchases.filter((p) => byKey.get(key(p))?.status === "SUSPENDED");

  // 3. Enrolled without a Purchase. Legitimate for a free Course, a scholarship,
  //    or a staff account; worth listing so an unexplained one is visible.
  const unpaid = enrollments.filter((e) => !purchaseKeys.has(key(e)));

  // 4. A status this code does not recognise, which `normalizeEnrollmentStatus`
  //    treats as no entitlement at all. Always a data fault.
  const unknownStatus = enrollments.filter(
    (e) => !(ENROLLMENT_STATUSES as readonly string[]).includes(e.status)
  );

  const flag = (n: number, note: string) => (n > 0 ? `  ${note}` : "");

  console.log("Entitlement reconciliation (ADR 0002)");
  console.log(`Connection: ${describeConnection()}\n`);

  console.log(`  Users                      ${users}`);
  console.log(`  Courses                    ${courses}`);
  console.log(`  Purchases                  ${purchases.length}`);
  console.log(`  Enrollments                ${enrollments.length}`);
  console.log(
    `  Paid with no Enrollment    ${missing.length}${flag(missing.length, "these would lose access")}`
  );
  console.log(`  Paid and SUSPENDED         ${suspended.length}`);
  console.log(
    `  Enrolled with no Purchase  ${unpaid.length}  (free, scholarship, or staff)`
  );
  console.log(
    `  Unrecognised status        ${unknownStatus.length}${flag(unknownStatus.length, "data fault")}`
  );

  // Ids are printed because an operator has to act on specific rows. This is an
  // operator tool run against a database they already administer, not a log line.
  for (const [label, rows] of [
    ["Paid with no Enrollment", missing],
    ["Unrecognised status", unknownStatus],
  ] as const) {
    if (rows.length === 0) continue;
    console.log(`\n${label}:`);
    for (const row of rows.slice(0, 50)) {
      console.log(`  user=${row.userId} course=${row.courseId}`);
    }
    if (rows.length > 50) console.log(`  ... and ${rows.length - 50} more`);
  }

  // The verdict, stated rather than left for the reader to infer from six zeros.
  if (users === 0 && courses === 0) {
    console.log(
      "\nThis database has no Users and no Courses either, so it is almost" +
        "\ncertainly not the one you meant. Check the connection above."
    );
    // Non-zero, so a CI or scripted caller cannot mistake this for a clean bill.
    process.exitCode = 1;
    return;
  }

  if (purchases.length === 0 && enrollments.length === 0) {
    console.log(
      `\nNothing to reconcile. This database holds ${users} user(s) and ` +
        `${courses} course(s)\nbut no Purchase or Enrollment rows at all, so the ` +
        "ADR 0002 cutover cannot\ncost anyone access here."
    );
    return;
  }

  if (missing.length === 0 && unknownStatus.length === 0) {
    console.log("\nNothing to reconcile: every Purchase has an Enrollment.");
  }

  if (!FIX) {
    if (missing.length > 0) {
      console.log("\nRe-run with --fix to create the missing Enrollments.");
    }
    return;
  }

  if (missing.length === 0) {
    console.log("\nNothing to fix.");
    return;
  }

  // createMany with skipDuplicates rather than a loop of upserts: it is one
  // statement, and the unique index makes a concurrent run harmless.
  const created = await db.enrollment.createMany({
    data: missing.map((p) => ({
      userId: p.userId,
      courseId: p.courseId,
      status: "ACTIVE",
      // The date the learner actually gained access, not this run's clock.
      enrolledAt: p.createdAt,
    })),
    skipDuplicates: true,
  });

  console.log(`\nCreated ${created.count} Enrollment(s). Existing statuses were not modified.`);
}

main()
  .catch((error) => {
    const message = error instanceof Error ? error.message : String(error);

    // The two failures an operator actually hits, named rather than left as a
    // Prisma invocation dump.
    if (/28P01|[Aa]uthentication failed/.test(message)) {
      console.error(
        `Could not authenticate on ${describeConnection()}.\n` +
          "If the password contains a $, quote the value in SINGLE quotes -- inside " +
          "double quotes the shell expands it, which presents as a bad password."
      );
    } else if (/42501|permission denied/.test(message)) {
      console.error(
        `Connected on ${describeConnection()}, but that role has no SELECT on ` +
          "Purchase or Enrollment.\n" +
          "Run `npm run db:roles` to see what each connection can do, then point " +
          "this script at a role that can read both -- the table owner, or an admin " +
          "connection. Note that DDL privileges do not imply SELECT: after #43 " +
          "`akomapa_migrate` can migrate without necessarily being able to read.\n" +
          "Override with DIRECT_URL='...' or DATABASE_URL='...' on the command line; " +
          "an exported value beats the dotenv files."
      );
    } else {
      console.error("Reconciliation failed:", message);
    }

    process.exitCode = 1;
  })
  .finally(async () => {
    await db.$disconnect();
  });
