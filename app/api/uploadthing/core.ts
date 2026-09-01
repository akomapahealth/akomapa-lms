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
 
 
export const ourFileRouter = {
    courseImage: f({ image: { maxFileSize: "4MB", maxFileCount: 1 } })
        .middleware(() => handleAuth())
        .onUploadComplete(() => {}),
    courseAttachment: f(["text", "image", "video", "audio", "pdf"])
        .middleware(() => handleAuth())
        .onUploadComplete(() => {}),
    chapterVideo: f({ video: { maxFileCount: 1, maxFileSize: "512GB" } })
        .middleware(() => handleAuth())
        .onUploadComplete(() => {})
} satisfies FileRouter;
 
export type OurFileRouter = typeof ourFileRouter;