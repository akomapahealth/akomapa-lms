import { createUploadthing, type FileRouter } from "uploadthing/next";
import { UploadThingError } from "uploadthing/server";

import { can, getPrincipal } from "@/lib/auth";

const f = createUploadthing();

// This route sits on the public matcher in proxy.ts, so it authenticates
// itself. UploadThing surfaces its own error type rather than a NextResponse,
// which is why it calls `can` directly instead of using the `authorize*` guards.
const handleAuth = async () => {
    const principal = await getPrincipal();

    if (!principal) throw new UploadThingError("Unauthorized");
    if (!can(principal, "upload:courseAsset")) {
        throw new UploadThingError("Forbidden");
    }

    return { userId: principal.userId };
};

/**
 * Upload limits are declared per endpoint and per file type (#44).
 *
 * Two of the three endpoints had no considered bound. `courseAttachment` was
 * `f(["text", "image", "video", "audio", "pdf"])`, which takes UploadThing's
 * per-type defaults rather than a size this product chose. `chapterVideo`
 * allowed `512GB`, which is UploadThing's ceiling and not a decision: a single
 * upload at that size is a storage bill and a denial-of-service surface, and Mux
 * would be asked to ingest it afterwards.
 *
 * The values below are deliberately generous -- a one-hour 1080p H.264 lecture
 * is roughly 1-3GB, so 8GB leaves room for 4K masters -- and are the kind of
 * limit that should move with evidence. They are bounds, not targets.
 */
export const ourFileRouter = {
    courseImage: f({ image: { maxFileSize: "4MB", maxFileCount: 1 } })
        .middleware(() => handleAuth())
        .onUploadComplete(() => {}),
    courseAttachment: f({
        text: { maxFileSize: "1MB", maxFileCount: 5 },
        image: { maxFileSize: "4MB", maxFileCount: 5 },
        pdf: { maxFileSize: "32MB", maxFileCount: 5 },
        audio: { maxFileSize: "64MB", maxFileCount: 2 },
        video: { maxFileSize: "1GB", maxFileCount: 1 },
    })
        .middleware(() => handleAuth())
        .onUploadComplete(() => {}),
    chapterVideo: f({ video: { maxFileCount: 1, maxFileSize: "8GB" } })
        .middleware(() => handleAuth())
        .onUploadComplete(() => {})
} satisfies FileRouter;

export type OurFileRouter = typeof ourFileRouter;
