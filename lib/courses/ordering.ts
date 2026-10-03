import { NUMBER } from "@/lib/http/limits";

/**
 * Keeping sibling positions unique (#51).
 *
 * Modules, Topics, Questions, and Question options are unique per parent and
 * position. Two things break that naively: a reorder that writes new positions
 * one row at a time briefly gives two rows the same position, and a create that
 * reads "last position + 1" races another create to the same number. The first
 * is solved by moving rows in two phases inside one transaction; the second by
 * retrying the create when the unique index refuses it.
 */

/**
 * Where rows wait during a reorder. Above any position a request may ask for,
 * so a temporary position can never collide with a real one.
 */
export const TEMPORARY_POSITION_BASE = NUMBER.maxPosition + 1;

export interface Placement {
  id: string;
  position: number;
}

/**
 * Applies new positions without ever giving two siblings the same one.
 *
 * Phase one parks every row at a distinct temporary position; phase two moves
 * each to its final position. Run it inside a transaction: if a final position
 * collides with a sibling the request did not list, the unique index refuses
 * the write and the whole reorder rolls back.
 */
export async function applyPlacements(
  placements: readonly Placement[],
  setPosition: (id: string, position: number) => Promise<unknown>
): Promise<void> {
  for (const [index, { id }] of placements.entries()) {
    await setPosition(id, TEMPORARY_POSITION_BASE + index);
  }
  for (const { id, position } of placements) {
    await setPosition(id, position);
  }
}

/** Whether an error is Prisma's unique-constraint violation. */
export function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    (error as { name?: unknown }).name === "PrismaClientKnownRequestError" &&
    (error as { code?: unknown }).code === "P2002"
  );
}

/** How many times a create races for a position before giving up. */
export const POSITION_ATTEMPTS = 3;

/**
 * Runs `create` -- which reads the last position and writes the next -- again
 * if a concurrent create took that position first. After the last attempt the
 * violation propagates, and `handleRouteError` answers it as a 409.
 */
export async function withPositionRetry<T>(create: () => Promise<T>): Promise<T> {
  for (let attempt = 1; ; attempt += 1) {
    try {
      return await create();
    } catch (error) {
      if (!isUniqueViolation(error) || attempt >= POSITION_ATTEMPTS) throw error;
    }
  }
}
