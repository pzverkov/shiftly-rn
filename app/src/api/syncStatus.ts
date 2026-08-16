import { useMutationState } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';

/**
 * The offline queue, read off React Query's mutation cache.
 *
 * Every write in this app is one mutation with a `shiftId` in its variables, so the
 * mutation cache already IS the queue - there is no second store to keep in sync.
 * This module derives a small, glanceable view of it for the UI:
 *
 *   - queued  - saved offline, paused, waiting for signal (pending && isPaused)
 *   - syncing - resumed and in flight on the wire (pending && !isPaused)
 *
 * The "synced" confirmation is a transient pulse, not a stored flag. Crucially it
 * fires only on a SUCCESSFUL drain: the pulse gate watches the success count, so a
 * queue that empties because a write was rejected (pending -> error) or re-paused on
 * a dropped signal does not flash a false "Synced" next to the error. See
 * useSettlePulse.
 */

/** The slice of a mutation's state this module reads. Kept flat so it is trivial to test. */
export type MutationView = {
  status: 'idle' | 'pending' | 'success' | 'error';
  isPaused: boolean;
  shiftId: string | undefined;
};

export type QueueSummary = { queued: number; syncing: number };

export type CardSyncState = 'idle' | 'queued' | 'syncing';

/** Active (still-pending) and succeeded counts for a scope - the pulse gate's inputs. */
export type PulseCounts = { active: number; succeeded: number };

export function summarize(views: MutationView[]): QueueSummary {
  let queued = 0;
  let syncing = 0;
  for (const v of views) {
    if (v.status !== 'pending') continue;
    if (v.isPaused) queued += 1;
    else syncing += 1;
  }
  return { queued, syncing };
}

/**
 * The sync state of one shift's writes. Syncing wins over queued: if the shift has
 * one write on the wire and another still paused behind it, the card should read as
 * making progress, not stuck.
 */
export function cardSyncState(views: MutationView[], shiftId: string): CardSyncState {
  const mine = views.filter((v) => v.shiftId === shiftId && v.status === 'pending');
  if (mine.some((v) => !v.isPaused)) return 'syncing';
  if (mine.length > 0) return 'queued';
  return 'idle';
}

/**
 * Pulse inputs for a scope: `active` is anything still pending (queued or syncing),
 * `succeeded` the writes that have landed. A drain to zero `active` only counts as
 * "synced" when `succeeded` rose across it - a rejection raises the error count, not
 * this one, and a re-pause keeps `active` above zero, so both are ignored.
 */
export function pulseCounts(views: MutationView[], shiftId?: string): PulseCounts {
  let active = 0;
  let succeeded = 0;
  for (const v of views) {
    if (shiftId !== undefined && v.shiftId !== shiftId) continue;
    if (v.status === 'pending') active += 1;
    else if (v.status === 'success') succeeded += 1;
  }
  return { active, succeeded };
}

/** Read every shift mutation's state as a flat MutationView[]. */
function useMutationViews(): MutationView[] {
  return useMutationState<MutationView>({
    select: (mutation) => ({
      status: mutation.state.status,
      isPaused: mutation.state.isPaused,
      // All four writes carry a shiftId; a mutation with none is not one of ours.
      shiftId: (mutation.state.variables as { shiftId?: string } | undefined)?.shiftId,
    }),
  });
}

export function useQueueSummary(): QueueSummary {
  return summarize(useMutationViews());
}

export function useCardSyncState(shiftId: string): CardSyncState {
  return cardSyncState(useMutationViews(), shiftId);
}

/**
 * How long the "Synced" pulse stays up after a queued write lands. Long enough to
 * be noticed by someone who was not watching the screen at the moment it drained,
 * short enough that it is gone before they reach for the next action.
 */
export const SETTLE_PULSE_HOLD_MS = 2_500;

/**
 * True for `holdMs` after a scope's queue drains to zero BY SUCCEEDING - the moment
 * a queued write lands. It fires only when `active` falls to zero while `succeeded`
 * has risen since the queue was last busy, so a drain caused by a rejection or a
 * re-pause produces no pulse. Re-arming (going active again) cancels a pending pulse
 * so a second drain gets its own clean one.
 */
export function useSettlePulse(
  active: number,
  succeeded: number,
  holdMs = SETTLE_PULSE_HOLD_MS,
): boolean {
  const [pulsing, setPulsing] = useState(false);
  const prev = useRef({ active, succeeded });

  useEffect(() => {
    const was = prev.current;
    prev.current = { active, succeeded };

    // Still working: cancel any pulse and wait for the drain.
    //
    // `set-state-in-effect` fires here and the disable is deliberate. The rule guards
    // against effects that derive state a render could have computed; this one cannot
    // be derived, because "pulsing" is a function of a timer elapsing, and the timer
    // is the external system this effect exists to synchronise with. In the common
    // case the value is already false and React bails out without re-rendering.
    if (active > 0) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setPulsing(false);
      return;
    }
    // Drained. Only a drain that added a success counts as synced.
    if (was.active > 0 && succeeded > was.succeeded) {
      setPulsing(true);
      const timer = setTimeout(() => setPulsing(false), holdMs);
      return () => clearTimeout(timer);
    }
  }, [active, succeeded, holdMs]);

  return pulsing;
}

/** The "synced" pulse for a scope: whole app when `shiftId` is omitted, else one shift. */
export function useSyncedPulse(shiftId?: string): boolean {
  const { active, succeeded } = pulseCounts(useMutationViews(), shiftId);
  return useSettlePulse(active, succeeded);
}
