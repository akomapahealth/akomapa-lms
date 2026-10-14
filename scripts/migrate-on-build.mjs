#!/usr/bin/env node
/**
 * Applies Prisma migrations during a production build, and skips them on
 * Vercel preview builds.
 *
 * Preview builders run in Vercel's region and cannot be relied on to reach the
 * migration database. A preview also must not apply schema changes to the
 * shared database. Production builds still run `prisma migrate deploy` before
 * `next build`, which is the deploy window the runbooks describe.
 */
import { execFileSync } from "node:child_process";

if (process.env.VERCEL_ENV === "preview") {
  console.log(
    "Skipping prisma migrate deploy on a Vercel preview build. Production builds still apply migrations.",
  );
  process.exit(0);
}

execFileSync("prisma", ["migrate", "deploy"], { stdio: "inherit" });
