import "server-only";

import Mux from "@mux/mux-node";

import { logError } from "@/lib/logger";

/**
 * Deletes Mux assets after the database rows that referenced them are gone (#51).
 *
 * Order matters. The Course and Topic delete routes used to delete the Mux asset
 * first and the row second; when the row delete was then refused -- which it now
 * is whenever learners hold records -- the content stayed live with its video
 * gone. Deleting the row first means a refusal touches nothing external.
 *
 * Best effort by design: a failed asset delete leaves an orphaned asset (a
 * storage cost, logged with its id for cleanup), never a live Topic without its
 * video, and never a failed request for a delete that already happened.
 */

let client: Mux | null = null;

function mux(): Mux {
  client ??= new Mux({
    tokenId: process.env.MUX_TOKEN_ID,
    tokenSecret: process.env.MUX_TOKEN_SECRET,
  });
  return client;
}

export async function deleteMuxAssets(assetIds: readonly string[], tag: string): Promise<void> {
  for (const assetId of assetIds) {
    try {
      await mux().video.assets.delete(assetId);
    } catch (error) {
      // A Mux asset id is an opaque identifier, safe to log.
      logError(`${tag}_MUX_CLEANUP`, error, { assetId });
    }
  }
}
