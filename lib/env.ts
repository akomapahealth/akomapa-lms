import { z } from "zod";

/**
 * Centralized, type-safe environment access.
 *
 * Design goals:
 * - Do NOT throw at import time. CI builds and static prerender run with
 *   placeholder values and some runtime-only secrets are intentionally absent,
 *   so eager validation would break the build.
 * - Provide fail-fast validation where it matters (webhook/API handlers) via
 *   `requireEnv`, and a full-schema check via `validateEnv` for scripts/CI.
 *
 * Names here are authoritative — they match what the code actually reads.
 */

const nonEmpty = z.string().min(1);

const serverSchema = z.object({
  // Database
  DATABASE_URL: nonEmpty,
  DIRECT_URL: z.string().optional(),

  // Clerk (server)
  CLERK_SECRET_KEY: nonEmpty,
  CLERK_WEBHOOK_SECRET: nonEmpty,

  // Mux
  MUX_TOKEN_ID: nonEmpty,
  MUX_TOKEN_SECRET: nonEmpty,

  // UploadThing (v7)
  UPLOADTHING_TOKEN: nonEmpty,

  // Stripe
  STRIPE_API_KEY: nonEmpty,
  STRIPE_WEBHOOK_SECRET: nonEmpty,

});

const clientSchema = z.object({
  NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: nonEmpty,
  NEXT_PUBLIC_CLERK_SIGN_IN_URL: z.string().default("/sign-in"),
  NEXT_PUBLIC_CLERK_SIGN_UP_URL: z.string().default("/sign-up"),
  NEXT_PUBLIC_CLERK_SIGN_IN_FALLBACK_REDIRECT_URL: z
    .string()
    .default("/dashboard"),
  NEXT_PUBLIC_CLERK_SIGN_UP_FALLBACK_REDIRECT_URL: z
    .string()
    .default("/dashboard"),
  NEXT_PUBLIC_APP_URL: nonEmpty,
  NEXT_PUBLIC_SITE_URL: z.string().optional(),
});

export const envSchema = serverSchema.merge(clientSchema);

export type ServerEnvKey = keyof z.infer<typeof serverSchema>;
export type Env = z.infer<typeof envSchema>;

/**
 * Validate the entire environment against the schema. Intended for scripts,
 * a dedicated CI check, or a one-off boot assertion — NOT for import-time use
 * in the app. Throws a readable error listing every missing/invalid variable.
 */
export function validateEnv(source: NodeJS.ProcessEnv = process.env): Env {
  const parsed = envSchema.safeParse(source);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((issue) => `  - ${issue.path.join(".")}: ${issue.message}`)
      .join("\n");
    throw new Error(`Invalid environment variables:\n${issues}`);
  }
  return parsed.data;
}

/**
 * Fail-fast accessor for required server-side variables. Use in webhook/API
 * handlers so a misconfigured deploy surfaces immediately with a clear message
 * instead of a late `undefined!` blow-up.
 */
export function requireEnv(key: ServerEnvKey): string {
  const value = process.env[key];
  if (!value || value.length === 0) {
    throw new Error(
      `Missing required environment variable: ${key}. ` +
        `Set it in your .env.local (see .env.example) or in the Vercel project settings.`,
    );
  }
  return value;
}
