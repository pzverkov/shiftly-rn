import { useEffect, useState } from 'react';
import { AppState, type AppStateStatus } from 'react-native';

import { serverNow, subscribeServerClock } from './serverClock';

const FAST_TICK_MS = 1_000;
const SLOW_TICK_MS = 30_000;
/** Within this distance of the target we care about the second hand. */
const FAST_TICK_THRESHOLD_MS = 60_000;

/**
 * A ticking `serverNow()`.
 *
 * Two things a naive `setInterval(fn, 1000)` gets wrong, both of which show up in
 * exactly the situation this app is for - a phone in a pocket during a shift:
 *
 *   - **Backgrounding.** Timers are throttled or suspended when the app is not
 *     foreground, and the OS is free to be aggressive about it on a low battery.
 *     Ticks are not a reliable clock, so we never accumulate them: every tick
 *     re-reads `serverNow()`, and coming back to the foreground re-reads it
 *     immediately rather than waiting for the next tick to land.
 *   - **Battery.** Re-rendering a list at 1Hz for a screen an employee leaves
 *     open costs real power for no benefit while the next action is 20 minutes
 *     out. We only tick per-second when something is about to happen.
 *
 * @param targetMs Timestamp the caller is counting towards, if any. Drives the
 *                 tick rate; pass `null` when nothing is imminent.
 */
export function useNow(targetMs: number | null): number {
  const [now, setNow] = useState(() => serverNow());

  const isFast = targetMs !== null && Math.abs(targetMs - now) < FAST_TICK_THRESHOLD_MS;

  useEffect(() => {
    const interval = setInterval(() => setNow(serverNow()), isFast ? FAST_TICK_MS : SLOW_TICK_MS);
    return () => clearInterval(interval);
  }, [isFast]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (status: AppStateStatus) => {
      if (status === 'active') setNow(serverNow());
    });
    return () => subscription.remove();
  }, []);

  // Re-read the moment the offset changes, so the first server sample corrects the
  // countdown immediately instead of at the next tick - up to 30s away in slow mode.
  useEffect(() => subscribeServerClock(() => setNow(serverNow())), []);

  return now;
}
