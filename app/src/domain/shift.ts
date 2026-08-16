/**
 * Pure shift logic. No React, no network, no clock of its own - `now` is always
 * injected so this stays deterministic and testable.
 *
 * The ordering of the checks in `getShiftState` deliberately mirrors the server's
 * `assertCanStartShift` (api/src/shifts/shifts-rules.pure.js) so the UI never offers an action the
 * server would reject. The server stays the authority; this is here so the client
 * can render honestly between requests.
 */

import { MINUTE } from '../time/constants';

export const SHIFT_START_WINDOW_MINUTES = 15;
export const SHIFT_FINISH_GRACE_MINUTES = 30;

/**
 * The branch geofence radius, mirrored from the server's `rules.js` for *display*
 * only - the client never enforces distance (the server does, see breaks.ts). Kept
 * here so the "too far / within Xm" copy can quote and unit-convert the same number
 * the server judges by.
 */
export const SHIFT_MAX_DISTANCE_METERS = 50;

export type GeoPoint = { lat: number; lng: number };

export type Shift = {
  id: string;
  userId: string;
  brand: { id: string; name: string };
  branch: { id: string; name: string; location: GeoPoint };
  startDate: string;
  endDate: string;
  startedAt: string | null;
  finishedAt: string | null;
  startedAtLocation: GeoPoint | null;
  finishedAtLocation: GeoPoint | null;
};

export type ShiftState =
  /** Scheduled for a later day. Nothing to do today. */
  | { kind: 'future' }
  /** Today, but the 15 minute window has not opened yet. */
  | { kind: 'upcoming'; msUntilWindow: number }
  /** Inside the window and not yet started - the one actionable state. */
  | { kind: 'clock-in-open' }
  /** Clocked in. */
  | { kind: 'started'; startedAt: string }
  /** Clocked out, or past the point where finishing is still allowed. */
  | { kind: 'finished' }
  /** The window came and went without a clock-in. */
  | { kind: 'missed' };

function isSameLocalDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

/**
 * Note this is evaluated against the *device's* local day, while the server uses
 * its own. A device in another timezone can disagree. That is tolerable because
 * this only drives display - the server rejects with SHIFT_WRONG_DAY regardless,
 * and that rejection is what the user ultimately sees.
 */
export function getShiftState(shift: Shift, now: number): ShiftState {
  if (shift.finishedAt) return { kind: 'finished' };

  const start = new Date(shift.startDate);
  const end = new Date(shift.endDate).getTime();

  if (shift.startedAt) {
    // Mirrors the server: a started shift stops being finishable past the grace
    // period, at which point it is done whether or not anyone clocked out.
    if (now > end + SHIFT_FINISH_GRACE_MINUTES * MINUTE) return { kind: 'finished' };
    return { kind: 'started', startedAt: shift.startedAt };
  }

  if (!isSameLocalDay(new Date(now), start)) {
    // Only future days are actionable later; a past day is a shift never started.
    return now < start.getTime() ? { kind: 'future' } : { kind: 'missed' };
  }

  const windowOpensAt = start.getTime() - SHIFT_START_WINDOW_MINUTES * MINUTE;
  if (now < windowOpensAt) {
    return { kind: 'upcoming', msUntilWindow: windowOpensAt - now };
  }

  // The server allows starting late - it only guards the early edge - so the
  // window stays open until the shift can no longer be finished at all.
  if (now > end + SHIFT_FINISH_GRACE_MINUTES * MINUTE) return { kind: 'missed' };

  return { kind: 'clock-in-open' };
}

/** The shift the home screen should foreground: the one the user can act on next. */
export function findActiveShift(shifts: Shift[], now: number): Shift | null {
  // Derive the state once per shift, then decide - the alternative recomputes
  // getShiftState for the filter, the started-shift lookup, and again per compare.
  const actionable = shifts
    .map((shift) => ({ shift, kind: getShiftState(shift, now).kind }))
    .filter(({ kind }) => kind === 'started' || kind === 'clock-in-open' || kind === 'upcoming');

  if (actionable.length === 0) return null;

  // A started shift always wins over one that merely could be started.
  const started = actionable.find(({ kind }) => kind === 'started');
  if (started) return started.shift;

  return actionable.reduce((soonest, current) =>
    new Date(current.shift.startDate) < new Date(soonest.shift.startDate) ? current : soonest,
  ).shift;
}

export function sortByStart(shifts: Shift[]): Shift[] {
  return [...shifts].sort(
    (a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime(),
  );
}
