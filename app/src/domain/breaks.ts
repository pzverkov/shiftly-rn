/**
 * Pure break/clock-out logic. Like `shift.ts`, `now` is injected so this stays
 * deterministic, and the check ordering mirrors the server's `assertCanFinishShift`
 * / `assertCanStartBreak` / `assertCanEndBreak` (api/src/shifts/shifts-rules.pure.js) so the UI
 * never offers an action the server would reject. The geofence lives on the server
 * alone; `canFinishShift` covers everything the client can decide locally.
 */

import type { Shift } from './shift';
import { SHIFT_FINISH_GRACE_MINUTES } from './shift';
import { MINUTE } from '../time/constants';

export const MIN_MINUTES_BEFORE_BREAK = 2;
export const MIN_MINUTES_BREAK_DURATION = 2;
export const MAX_BREAKS_PER_SHIFT = 2;

export type Break = {
  id: string;
  shiftId: string;
  startedAt: string;
  endedAt: string | null;
};

/** The one open break, if any. An active break has `endedAt === null`. */
export function getActiveBreak(breaks: Break[]): Break | null {
  return breaks.find((brk) => brk.endedAt === null) ?? null;
}

/**
 * Mirrors `assertCanFinishShift` minus the geofence: a started, not-yet-finished
 * shift can be clocked out until the finish grace period lapses.
 */
export function canFinishShift(shift: Shift, now: number): boolean {
  if (!shift.startedAt || shift.finishedAt) return false;
  const end = new Date(shift.endDate).getTime();
  return now <= end + SHIFT_FINISH_GRACE_MINUTES * MINUTE;
}

export type BreakEligibility = {
  canStart: boolean;
  canEnd: boolean;
  /** Only set when a start is blocked for a reason worth showing the user. */
  startBlockedReason?: 'too-soon' | 'limit-reached';
};

/**
 * Mirrors `assertCanStartBreak` / `assertCanEndBreak`. The ordering matches the
 * server so the reason we surface is the same one the server would reject with.
 */
export function breakEligibility(shift: Shift, breaks: Break[], now: number): BreakEligibility {
  const active = getActiveBreak(breaks);

  const canEnd =
    active !== null && now >= new Date(active.startedAt).getTime() + MIN_MINUTES_BREAK_DURATION * MINUTE;

  // A start is only offered on a live shift with no break already open.
  if (!shift.startedAt || shift.finishedAt || active) {
    return { canStart: false, canEnd };
  }
  if (breaks.length >= MAX_BREAKS_PER_SHIFT) {
    return { canStart: false, canEnd, startBlockedReason: 'limit-reached' };
  }
  const earliestBreak = new Date(shift.startedAt).getTime() + MIN_MINUTES_BEFORE_BREAK * MINUTE;
  if (now < earliestBreak) {
    return { canStart: false, canEnd, startBlockedReason: 'too-soon' };
  }
  return { canStart: true, canEnd };
}
