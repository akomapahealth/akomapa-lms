import { createHmac, hkdfSync } from "node:crypto";

/**
 * Bucket keys that identify nobody (#46).
 *
 * A bucket is keyed by policy, dimension, and subject -- a Clerk user id or an
 * IP network. Stored as-is, the table would be a log of who did what from where.
 * Hashed without a secret, an IPv4 key is reversible by trying all 2^32
 * addresses. So the key is an HMAC under a server-held secret.
 *
 * The secret is derived from `CLERK_SECRET_KEY` with HKDF and a label unique to
 * this purpose, rather than a new variable: every deployment already has it,
 * there is no second secret to forget to provision, and the label means the
 * derived key is useless for anything Clerk does. Rotating the Clerk key resets
 * every bucket, which is harmless -- limits refill within their period anyway.
 */

const HKDF_SALT = "akomapa-academy";
const HKDF_INFO = "rate-limit-bucket-key/v1";

/** Prefix that versions the key format, so a future change cannot collide. */
const KEY_PREFIX = "rl1:";

let cached: { source: string; key: Buffer } | null = null;

/** Thrown when the deployment has no secret to derive keys from. */
export class RateLimitConfigError extends Error {
  constructor() {
    super("CLERK_SECRET_KEY is not set; rate-limit keys cannot be derived");
    this.name = "RateLimitConfigError";
  }
}

function derivedKey(env: Record<string, string | undefined>): Buffer {
  const source = env.CLERK_SECRET_KEY;
  if (source === undefined || source.length === 0) throw new RateLimitConfigError();

  if (cached === null || cached.source !== source) {
    cached = {
      source,
      key: Buffer.from(hkdfSync("sha256", source, HKDF_SALT, HKDF_INFO, 32)),
    };
  }
  return cached.key;
}

/**
 * The stored key for one bucket.
 *
 * The three parts are joined with a separator that cannot occur in a policy
 * name or a dimension, so `("a", "user", "b|c")` and `("a|user", ...)` cannot
 * produce the same input.
 */
export function bucketKey(
  policy: string,
  dimension: "user" | "ip",
  subject: string,
  env: Record<string, string | undefined> = process.env
): string {
  const mac = createHmac("sha256", derivedKey(env))
    .update(`${policy}\u0000${dimension}\u0000${subject}`)
    .digest("base64url");
  return `${KEY_PREFIX}${mac}`;
}
