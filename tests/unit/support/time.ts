import { vi } from "vitest";

/**
 * Pins the system clock to an exact instant for the duration of a test.
 *
 * Timers are faked but not advanced, so `new Date()` inside the code under test
 * is stable while `await` still resolves normally. `afterEach` in ./setup
 * restores real timers.
 */
export function freezeTimeAt(iso: string): Date {
  const instant = new Date(iso);
  if (Number.isNaN(instant.getTime())) {
    throw new Error(`freezeTimeAt received an invalid instant: ${iso}`);
  }
  vi.useFakeTimers({ shouldAdvanceTime: true, now: instant });
  return instant;
}

/** Midnight UTC on the given calendar date, matching how the app strips time. */
export function dayStart(iso: string): Date {
  const [year, month, day] = iso.split("-").map(Number);
  return new Date(year, month - 1, day);
}
