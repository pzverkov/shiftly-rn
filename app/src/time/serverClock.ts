/**
 * A server-authoritative clock.
 *
 * Device clocks are wrong more often than is comfortable - a phone that ran flat
 * boots to a bogus time until NTP resyncs, and users can set the clock by hand.
 * Two things here depend on the time being right:
 *
 *   1. The countdown, which decides when the clock-in button unlocks. A skewed
 *      device would unlock it at the wrong moment.
 *   2. The `datetime` we send when clocking in. We send it (rather than letting
 *      the server default to its own clock) so that a clock-in queued offline
 *      still records the time the user actually pressed the button, not the time
 *      we happened to reconnect. Sending it means it has to be trustworthy.
 *
 * Every response carries a `Date` header, so we sample it and keep the offset.
 * Until the first response lands the offset is 0, i.e. plain device time - the
 * status quo, not a regression.
 *
 * The offset lives only for the session. It is deliberately not persisted: the
 * one thing persistence would protect - an offline clock-in replayed after the app
 * is killed - already carries its own server-anchored press time in the persisted
 * mutation, so a stored offset would add risk (a stale value corrupting serverNow
 * until the next sync) for no real benefit.
 *
 * `subscribe` lets the countdown re-read the offset the instant a sample lands
 * rather than waiting for its next tick.
 */

let offsetMs = 0;
const listeners = new Set<() => void>();

function notify(): void {
  listeners.forEach((listener) => listener());
}

/** Feed the `Date` header of a response known to come from our API. */
export function sampleServerDate(header: string | null): void {
  if (!header) return;

  const serverTime = Date.parse(header);
  if (Number.isNaN(serverTime)) return;

  // The header has one-second resolution and the round trip adds its own delay,
  // so this is accurate to roughly a second. That is far below the 15-minute
  // window this feeds, so no round-trip correction is worth the complexity.
  offsetMs = serverTime - Date.now();
  notify();
}

/** Milliseconds since epoch, corrected towards the server's clock. */
export function serverNow(): number {
  return Date.now() + offsetMs;
}

/** Subscribe to offset changes. Returns an unsubscribe function. */
export function subscribeServerClock(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getOffsetMs(): number {
  return offsetMs;
}

/** Test seam. */
export function resetServerClock(): void {
  offsetMs = 0;
  listeners.clear();
}
