-- Domain events (#49, ADR 0004).
--
-- The outbox's write side: commands append an event here in the same
-- transaction as the state change that caused it. Delivery -- claiming rows
-- under concurrent cron invocations, retry with backoff, parking poison
-- messages -- is #69 (ADR 0005); the lease and attempt columns exist now so the
-- table does not change shape when the processor arrives.
--
-- Additive. Rollback: DROP TABLE "OutboxEvent"; DROP TYPE "DomainEventType";
-- after deploying code that no longer writes events.

-- CreateEnum
CREATE TYPE "DomainEventType" AS ENUM ('TOPIC_COMPLETED', 'TOPIC_UNCOMPLETED', 'MODULE_COMPLETED', 'COURSE_COMPLETED', 'CERTIFICATE_ISSUED', 'BADGE_AWARDED', 'QUIZ_ATTEMPT_COMPLETED');

-- CreateTable
CREATE TABLE "OutboxEvent" (
    "id" TEXT NOT NULL,
    "type" "DomainEventType" NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "aggregateType" TEXT NOT NULL,
    "aggregateId" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "dedupeKey" TEXT NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "availableAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "leasedUntil" TIMESTAMP(3),
    "leasedBy" TEXT,
    "completedAt" TIMESTAMP(3),
    "lastError" TEXT,

    CONSTRAINT "OutboxEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "OutboxEvent_dedupeKey_key" ON "OutboxEvent"("dedupeKey");

-- CreateIndex
CREATE INDEX "OutboxEvent_completedAt_availableAt_idx" ON "OutboxEvent"("completedAt", "availableAt");

-- CreateIndex
CREATE INDEX "OutboxEvent_aggregateType_aggregateId_idx" ON "OutboxEvent"("aggregateType", "aggregateId");

