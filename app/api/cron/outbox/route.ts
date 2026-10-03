import { NextResponse } from "next/server";

import { db } from "@/lib/db";
import { handleRouteError } from "@/lib/http";
import { assertCronRequest } from "@/lib/http/cron";
import { logRun, outboxHealth, purgeDelivered, runOutbox } from "@/lib/outbox/processor";
import { sweepExpired } from "@/lib/rate-limit/store";

/**
 * The scheduled outbox run (#69, ADR 0005). Vercel Cron calls it on the
 * schedule in vercel.json; operators can run the same work on demand with
 * `npm run outbox -- process`.
 *
 * One run: deliver due events until none are left or the time budget is spent,
 * purge delivered events past retention, sweep expired rate-limit buckets, and
 * log one structured line with the queue's health. A run that stops for its
 * budget leaves the rest for the next one.
 */

// Hobby functions may run for 60 seconds; the processor stops claiming at 45.
export const maxDuration = 60;
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    assertCronRequest(req);

    const now = new Date();
    const summary = await runOutbox();
    const purged = await purgeDelivered(db, now);
    await sweepExpired(now.getTime());
    const health = await outboxHealth(db, new Date());

    logRun(summary, health, purged);

    return NextResponse.json({ summary, health, purged });
  } catch (error) {
    return handleRouteError("CRON_OUTBOX", error);
  }
}
