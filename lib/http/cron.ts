import { createHash, timingSafeEqual } from "node:crypto";

import { logError } from "@/lib/logger";

import { ApiError } from "./problem";

/**
 * Authenticates a scheduled invocation (#69).
 *
 * Vercel Cron calls a route with `Authorization: Bearer <CRON_SECRET>` when the
 * project defines `CRON_SECRET`. Anyone else who finds the URL must be refused:
 * the processor delivers events and deletes old rows, and it is a GET, so the
 * origin guard (#45) does not apply to it.
 *
 * - The comparison is constant-time over hashes, so neither the secret's
 *   length nor its content leaks through timing.
 * - Fails closed: with no `CRON_SECRET` configured, every request is refused as
 *   a server fault (and logged), never accepted.
 */
export function assertCronRequest(
  request: Request,
  env: Record<string, string | undefined> = process.env
): void {
  const secret = env.CRON_SECRET;
  if (secret === undefined || secret.length < 16) {
    const error = new ApiError("internal", { message: "CRON_SECRET is not configured" });
    logError("CRON_CONFIG", new Error("CRON_SECRET is missing or shorter than 16 characters"), {
      correlationId: error.correlationId,
    });
    throw error;
  }

  const header = request.headers.get("authorization") ?? "";
  const presented = header.startsWith("Bearer ") ? header.slice("Bearer ".length) : "";
  const digest = (value: string) => createHash("sha256").update(value).digest();

  if (!timingSafeEqual(digest(presented), digest(secret))) {
    throw new ApiError("unauthenticated", { message: "cron request without a valid secret" });
  }
}
