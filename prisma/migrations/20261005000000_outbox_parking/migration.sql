-- Outbox poison isolation (#69, ADR 0005 point 5).
--
-- An event that exhausts its retries, or whose stored payload no longer
-- validates, is parked: never claimed again until an operator replays or
-- discards it with `npm run outbox`. Parking is what keeps one bad event from
-- retrying forever or blocking the rest.
--
-- Additive; existing rows are unparked. Rollback: DROP INDEX
-- "OutboxEvent_parkedAt_idx"; ALTER TABLE "OutboxEvent" DROP COLUMN "parkedAt";
-- after deploying code that does not read it.

-- AlterTable
ALTER TABLE "OutboxEvent" ADD COLUMN     "parkedAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "OutboxEvent_parkedAt_idx" ON "OutboxEvent"("parkedAt");

