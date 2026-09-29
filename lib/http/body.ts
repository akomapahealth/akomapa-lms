import { ApiError } from "./problem";

/**
 * Reading a request body without trusting its size or its encoding (#44).
 *
 * `await req.json()` -- what every handler did before -- buffers the whole body
 * first and only then discovers it is 50MB, and it reports a parse failure the
 * same way it reports a network fault. Both of those matter on a route that
 * writes to the database.
 */

const JSON_TYPES = new Set(["application/json"]);

/**
 * True for `application/json` and for any structured-suffix type like
 * `application/merge-patch+json`.
 */
function isJsonType(mediaType: string): boolean {
  return JSON_TYPES.has(mediaType) || mediaType.endsWith("+json");
}

/** The media type alone, with parameters and casing removed. */
function mediaTypeOf(header: string | null): string | null {
  if (header === null) return null;
  const type = header.split(";", 1)[0]!.trim().toLowerCase();
  return type.length > 0 ? type : null;
}

/**
 * Rejects a body larger than `maxBytes` *while* reading it, not after.
 *
 * `Content-Length` is checked first as a cheap rejection, but it is a client
 * claim: a chunked request need not send one, and one that does may lie. The
 * streaming count is what actually enforces the limit, and it stops pulling as
 * soon as the limit is passed rather than buffering the rest to measure it.
 */
export async function readBoundedText(req: Request, maxBytes: number): Promise<string> {
  const declared = Number(req.headers.get("content-length"));
  if (Number.isFinite(declared) && declared > maxBytes) {
    throw new ApiError("payload_too_large");
  }

  const chunks: Uint8Array[] = [];
  let total = 0;

  const stream = req.body;
  if (stream === null) {
    // No stream to meter (an empty body, or a Request built without one).
    const text = await req.text();
    if (new TextEncoder().encode(text).byteLength > maxBytes) {
      throw new ApiError("payload_too_large");
    }
    return text;
  }

  const reader = stream.getReader();
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value === undefined) continue;

      total += value.byteLength;
      if (total > maxBytes) {
        // Stop reading. Draining the rest would let a sender spend our
        // bandwidth and memory after the answer is already decided.
        await reader.cancel();
        throw new ApiError("payload_too_large");
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }

  const joined = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    joined.set(chunk, offset);
    offset += chunk.byteLength;
  }

  try {
    // `fatal` so malformed UTF-8 is rejected rather than silently turned into
    // replacement characters and stored.
    return new TextDecoder("utf-8", { fatal: true }).decode(joined);
  } catch {
    throw new ApiError("malformed_json");
  }
}

/**
 * The parsed JSON body, bounded and type-checked, as `unknown`.
 *
 * Returns `unknown` on purpose: the caller must put it through a schema. Handing
 * back `any` is how unvalidated bodies reached the database in the first place.
 */
export async function readJson(req: Request, maxBytes: number): Promise<unknown> {
  const mediaType = mediaTypeOf(req.headers.get("content-type"));

  // A missing Content-Type is rejected rather than assumed to be JSON. Guessing
  // is what lets a form-encoded or text/plain body reach a JSON parser, and it
  // is a precondition for the CSRF work in #45, which needs the declared type to
  // be one a simple cross-origin form cannot produce.
  if (mediaType === null || !isJsonType(mediaType)) {
    throw new ApiError("unsupported_media_type");
  }

  const text = await readBoundedText(req, maxBytes);

  if (text.trim().length === 0) {
    throw new ApiError("malformed_json");
  }

  try {
    return JSON.parse(text);
  } catch {
    // The parser's own message quotes the offending input and its position,
    // which is exactly what must not travel back to the client.
    throw new ApiError("malformed_json");
  }
}
