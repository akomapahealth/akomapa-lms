import type { NextRequest } from "next/server";
import { createRouteHandler } from "uploadthing/next";

import {
  assertTrustedOrigin,
  handleRouteError,
  isUploadThingServerCallback,
} from "@/lib/http";

import { ourFileRouter } from "./core";

const handlers = createRouteHandler({
  router: ourFileRouter,
});

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
 */
export async function POST(req: NextRequest) {
  if (!isUploadThingServerCallback(req)) {
    try {
      assertTrustedOrigin(req);
    } catch (error) {
      return handleRouteError("UPLOADTHING", error);
    }
  }

  return handlers.POST(req);
}
