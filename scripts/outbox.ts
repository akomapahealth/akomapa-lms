/**
 * Operator tooling for the outbox (#69, ADR 0005). Runbook: docs/runbooks/outbox.md.
 *
 *   npm run outbox -- stats                       depth, oldest pending, parked
 *   npm run outbox -- parked [--limit 50]         parked events and their errors
 *   npm run outbox -- replay <eventId>... | --all requeue parked events with a fresh retry budget
 *   npm run outbox -- discard <eventId>... --reason "<why>"
 *                                                 close parked events nobody should deliver
 *   npm run outbox -- process [--url http://localhost:3000]
 *                                                 run the processor now, through the cron route
 *
 * `process` calls the same /api/cron/outbox the schedule calls, with
 * CRON_SECRET, so a local run exercises exactly what production runs. It needs
 * the app to be running at --url.
 *
 * Output names events by id and type, never by payload. Connection precedence
 * matches the other operator scripts: an exported value beats a dotenv file,
 * and DIRECT_URL beats DATABASE_URL.
 *
 * Exit status: 0 on success; 1 when `stats` finds parked events or a command
 * changes nothing it was asked to; 2 on a usage or connection error.
 */
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import { config } from "dotenv";
import { Pool } from "pg";

import { discardParked, listParked, outboxHealth, replayParked } from "../lib/outbox/operations";

const exported = {
  DIRECT_URL: process.env.DIRECT_URL,
  DATABASE_URL: process.env.DATABASE_URL,
  CRON_SECRET: process.env.CRON_SECRET,
};

config();
config({ path: ".env.local", override: true });

function flag(args: string[], name: string): string | undefined {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : undefined;
}

function connection(): string | null {
  const candidates = [exported.DIRECT_URL, exported.DATABASE_URL, process.env.DIRECT_URL, process.env.DATABASE_URL];
  return candidates.find((value) => Boolean(value)) ?? null;
}

async function processNow(args: string[]): Promise<number> {
  const base = flag(args, "--url") ?? "http://localhost:3000";
  const secret = exported.CRON_SECRET ?? process.env.CRON_SECRET;
  if (!secret) {
    console.error("CRON_SECRET is not set; the cron route refuses calls without it.");
    return 2;
  }
  const response = await fetch(new URL("/api/cron/outbox", base), {
    headers: { authorization: `Bearer ${secret}` },
  });
  console.log(`${response.status} ${JSON.stringify(await response.json(), null, 2)}`);
  return response.ok ? 0 : 1;
}

async function main(): Promise<number> {
  const [command, ...args] = process.argv.slice(2);

  if (command === "process") return processNow(args);

  const connectionString = connection();
  if (!connectionString) {
    console.error("No connection string. Set DIRECT_URL or DATABASE_URL.");
    return 2;
  }
  const pool = new Pool({ connectionString });
  const db = new PrismaClient({ adapter: new PrismaPg(pool) });

  try {
    switch (command) {
      case "stats": {
        const health = await outboxHealth(db);
        console.log(JSON.stringify(health, null, 2));
        return health.parked > 0 ? 1 : 0;
      }
      case "parked": {
        const limit = Number(flag(args, "--limit") ?? 50);
        const parked = await listParked(db, Number.isFinite(limit) && limit > 0 ? limit : 50);
        for (const event of parked) {
          console.log(
            `${event.id}  ${event.type}  attempts=${event.attempts}  parked=${event.parkedAt?.toISOString()}  ${event.lastError ?? ""}`
          );
        }
        console.log(`${parked.length} parked`);
        return 0;
      }
      case "replay": {
        const ids = args.filter((arg) => !arg.startsWith("--"));
        if (!args.includes("--all") && ids.length === 0) {
          console.error("Name event ids, or pass --all.");
          return 2;
        }
        const count = await replayParked(db, args.includes("--all") ? "all" : ids);
        console.log(`Requeued ${count} parked event(s).`);
        return count > 0 ? 0 : 1;
      }
      case "discard": {
        const reason = flag(args, "--reason");
        const ids = args.filter((arg, i) => !arg.startsWith("--") && args[i - 1] !== "--reason");
        if (!reason || ids.length === 0) {
          console.error('Name event ids and give --reason "<why>".');
          return 2;
        }
        const count = await discardParked(db, ids, reason);
        console.log(`Discarded ${count} parked event(s).`);
        return count > 0 ? 0 : 1;
      }
      default:
        console.error("Usage: npm run outbox -- stats | parked | replay <id>...|--all | discard <id>... --reason <why> | process [--url <base>]");
        return 2;
    }
  } finally {
    await db.$disconnect();
    await pool.end();
  }
}

main()
  .then((code) => process.exit(code))
  .catch((error: unknown) => {
    console.error("outbox:", error instanceof Error ? error.message : error);
    process.exit(2);
  });
