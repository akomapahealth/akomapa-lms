# Outbox processor

How recorded domain events are delivered, how to run and watch the processor,
and what to do when an event cannot be delivered.

- **Issue:** [#69](https://github.com/akomapahealth/akomapa-lms/issues/69)
- **Decision:** [ADR 0005](../adr/0005-transactional-outbox-processing.md)
- **Code:** `lib/outbox/processor.ts` (delivery), `lib/outbox/operations.ts`
  (health, retention, replay), `lib/outbox/handlers.ts` (consumers),
  `app/api/cron/outbox/route.ts` (the scheduled entry point),
  `lib/http/cron.ts` (its authentication)
- **Schedule:** `vercel.json`, daily at 03:00 UTC
- **CLI:** `npm run outbox`

## How it works

Commands record an event in the same transaction as the state change it
describes ([learning-completion.md](learning-completion.md)). The processor
delivers them:

1. **Claim.** Take up to 25 due events with `FOR UPDATE SKIP LOCKED` and a
   5-minute lease. Concurrent runs take disjoint rows. A crashed worker's
   events return when its lease expires.
2. **Deliver.** Hand each event to its consumer, which re-reads the state it
   needs. Delivery is at least once, so every consumer is idempotent.
3. **Record.** On success, `completedAt`. On failure, `attempts + 1`,
   `lastError`, and `availableAt` pushed out by exponential backoff: 1 min,
   2 min, 4 min, and so on, ±20%, capped at 6 hours. After the 8th attempt, or
   at once if the payload no longer validates or a consumer reports a permanent
   failure, the event is **parked**. Every outcome is written only while the
   worker still holds the lease.
4. **Stop** claiming after 45 seconds; the function may run for 60. Whatever is
   left waits for the next run.

Each run also deletes delivered events older than 30 days (parked events are
kept), sweeps expired rate-limit buckets, and logs one `OUTBOX_RUN` line.

## Schedule

**Daily**, because the team is on the Vercel Hobby plan, which refuses crons
more frequent than daily. Nothing a learner does waits on it:

- Certificate PDFs render the first time a learner opens their Certificate, so
  the nightly run only renders ones nobody has opened yet.
- Every other event type has no consumer yet.

**On Pro,** change `vercel.json`'s schedule to `"* * * * *"`. A run takes
seconds, the lease and SKIP LOCKED make overlapping runs safe, and delivery
latency drops to about a minute.

## Setup

1. Generate a secret: `openssl rand -hex 32`.
2. Set `CRON_SECRET` in **every** Vercel environment (Production, Preview,
   Development). Vercel sends it as `Authorization: Bearer <CRON_SECRET>` on each
   scheduled call.
3. Deploy. The cron appears under Project → Settings → Cron Jobs, where it can
   also be run by hand.

Without `CRON_SECRET` (or with one shorter than 16 characters), the route
refuses every call and logs `CRON_CONFIG`. It fails closed. A request with the
wrong secret gets 401 and does no work.

## Operating it

```sh
npm run outbox -- stats                  # pending, oldest pending (s), parked; exit 1 if any parked
npm run outbox -- parked                 # parked events: id, type, attempts, error
npm run outbox -- replay <id>...         # requeue with a fresh retry budget (or --all)
npm run outbox -- discard <id>... --reason "consumer retired"
npm run outbox -- process --url https://<deployment>   # run now, through the cron route
```

`stats`, `parked`, `replay`, and `discard` connect with `DIRECT_URL` (or
`DATABASE_URL`), like the other operator scripts. `process` calls the cron
route with `CRON_SECRET`, so it needs the app running at `--url`. Locally, run
`npm run dev`, then `npm run outbox -- process`.

Output names events by id and type only. Payloads carry learner identifiers and
are never printed or logged.

### When something is parked

1. `npm run outbox -- parked` shows the error. Typical causes:
   - a consumer bug (fix and deploy it);
   - a dependency that was down for hours (wait until it is back);
   - a payload from before a schema change (decide whether the event still
     matters).
2. Once the cause is fixed: `npm run outbox -- replay <id>`, then
   `npm run outbox -- process` or wait for the next run.
3. If the event should never be delivered, for example because its consumer
   was retired: `npm run outbox -- discard <id> --reason "<why>"`. The reason is
   kept on the row.

Never edit or delete outbox rows by hand. A row deleted before delivery is an
effect silently lost.

## Signals and alerts

Each run logs `OUTBOX_RUN` with `claimed`, `delivered`, `retried`, `parked`,
`leaseLost`, `stoppedForBudget`, `durationMs`, `pending`,
`oldestPendingSeconds`, the parked count, and `purged`. It logs at info level,
or at warn level when anything is parked. `OUTBOX_RETRY` and `OUTBOX_PARKED`
name individual events by id and type.

Until [#102](https://github.com/akomapahealth/akomapa-lms/issues/102) wires
alerts, these are log queries:

| Signal | Threshold (daily schedule) | Meaning and action |
| --- | --- | --- |
| No `OUTBOX_RUN` line | None for 26 hours | The cron is not running. Check Project → Cron Jobs and `CRON_CONFIG` errors |
| `CRON_CONFIG` error | Any | `CRON_SECRET` is missing in that environment |
| `OUTBOX_RUN` with the parked count > 0 | Any | Follow "When something is parked" |
| `oldestPendingSeconds` | Over 2 days | Runs are not keeping up, or every delivery is failing |
| `stoppedForBudget: true` | Several runs in a row | The backlog exceeds a run. Run `process` by hand, or move to a more frequent schedule |
| `leaseLost` > 0 | Repeatedly | A delivery is taking longer than the 5-minute lease; investigate the consumer |

On a minutely schedule, divide the time thresholds accordingly: no run for 10
minutes, oldest pending over 30 minutes.

## Failure behavior

- **Database unavailable:** the run fails with a logged 500 and nothing is
  claimed. The next run continues.
- **A consumer's dependency is down:** its events retry with backoff and park
  after the 8th failed attempt. The backoff delays add up to about 2 hours,
  but a failing event is retried at most once per run. On the daily schedule
  it therefore parks after about 8 days; on a minutely one, after about
  2 hours. Replay it once the dependency recovers. Other events are
  unaffected.
- **A run is killed mid-delivery:** its leased events return after 5 minutes,
  and idempotent consumers make the repeat harmless.

## Rollback

Remove the cron (delete the `crons` entry in `vercel.json`) and revert the
code. Recorded events stay in the table, undelivered, which is the state before
#69. Certificates still render on first view. To drop the parking column too,
deploy the previous release, then run
`ALTER TABLE "OutboxEvent" DROP COLUMN "parkedAt";` and
`npx prisma migrate resolve --rolled-back 20261005000000_outbox_parking`.
