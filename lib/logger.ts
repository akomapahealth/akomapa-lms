const isProd = process.env.NODE_ENV === "production";

export function logError(tag: string, error: unknown) {
  if (isProd) {
    // In production, log tag and message only - no stack traces
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error(JSON.stringify({ tag, message, timestamp: new Date().toISOString() }));
  } else {
    console.error(`[${tag}]`, error);
  }
}
