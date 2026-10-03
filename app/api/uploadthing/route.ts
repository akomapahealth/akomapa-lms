import { NextResponse, type NextRequest } from "next/server";
import { createRouteHandler } from "uploadthing/next";

import { getPrincipal } from "@/lib/auth";
import {
  assertTrustedOrigin,
  handleRouteError,
  isUploadThingServerCallback,
} from "@/lib/http";
import { enforceRateLimit } from "@/lib/rate-limit";

import { ourFileRouter } from "./core";

const handlers = createRouteHandler({
  router: ourFileRouter,
});

/**
 * UploadThing's client shows a top-level `message` from an error body and
 * ignores the rest, so a refusal from this wrapper -- an untrusted origin, a
 * rate limit, a store outage -- would otherwise reach the author as a generic
 * failure. The contract's own fixed message is copied up beside the standard
 * `error` object; nothing else changes, and nothing in it came from the request.
 */
async function forUploadThingClient(response: NextResponse): Promise<NextResponse> {
  const body = (await response.json()) as { error: { message: string } };
  return NextResponse.json(
    { ...body, message: body.error.message },
    { status: response.status, headers: response.headers }
  );
}

/** The route configuration the client library reads. Changes nothing. */
export const GET = handlers.GET;

/**
 * Two kinds of caller share this POST (#45).
 *
 * A browser asks for presigned upload URLs with `?actionType=upload` and its
 * Clerk session cookie. That is a cookie-authenticated mutation like any other,
 * so it is origin-guarded: without the guard, a hostile page could have a signed
 * in author's browser request upload slots.
 *
 * UploadThing's servers call back with an `uploadthing-hook` header when an
 * upload finishes or fails. They send no `Origin`, and the library verifies
 * each callback's HMAC signature before running `onUploadComplete`, so those --
 * and only those -- skip the guard. See `isUploadThingServerCallback` and the
 * exemption list in lib/http/origin.ts.
 *
 * Browser requests are also rate limited (#46) under `upload.request`, by user
 * when signed in and by address regardless. Storage and Mux ingest are billed,
 * so the policy fails closed. Callbacks are not limited: each one follows an
 * upload slot that was already counted, and they are signature-verified.
 * The route sits on the proxy's public matcher, so the principal is optional
 * here; core.ts still refuses an anonymous upload.
 */
export async function POST(req: NextRequest) {
  if (!isUploadThingServerCallback(req)) {
    try {
      assertTrustedOrigin(req);
      const principal = await getPrincipal();
      await enforceRateLimit(req, "upload.request", { userId: principal?.userId });
    } catch (error) {
      return forUploadThingClient(handleRouteError("UPLOADTHING", error));
    }
  }

  return handlers.POST(req);
}
