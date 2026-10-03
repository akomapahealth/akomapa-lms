-- Abuse controls (#46): the shared, cross-instance store for rate limits.
--
-- Additive only. A row is a GCRA bucket keyed by an HMAC of policy, dimension,
-- and subject, so no user id or IP address is stored in the clear. Rows whose
-- "expiresAt" has passed are equivalent to absent rows and are deleted
-- opportunistically by lib/rate-limit/store.ts.
--
-- The runtime role (akomapa_app) receives SELECT/INSERT/UPDATE/DELETE on this
-- table through the default privileges set by scripts/sql/create-database-roles.sql.
--
-- Rollback: DROP TABLE "RateLimitBucket"; -- holds only short-lived counters.

-- CreateTable
CREATE TABLE "RateLimitBucket" (
    "key" TEXT NOT NULL,
    "tat" BIGINT NOT NULL,
    "allowed" BOOLEAN NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RateLimitBucket_pkey" PRIMARY KEY ("key")
);

-- CreateIndex
CREATE INDEX "RateLimitBucket_expiresAt_idx" ON "RateLimitBucket"("expiresAt");
