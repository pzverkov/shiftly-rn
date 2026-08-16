import { apiFetch } from './client';
import type { Break } from '../domain/breaks';
import type { GeoPoint, Shift } from '../domain/shift';

/**
 * The API has no auth and operates on a single demo user. We treat "already
 * signed in as user-demo" as given, which the brief explicitly allows.
 */
export const DEMO_USER_ID = 'user-demo';

/**
 * The press timestamps every write carries, so an offline replay records the
 * moment the user acted rather than the moment the signal returned.
 */
export type TimedActionVariables = {
  shiftId: string;
  /**
   * When the user pressed the button, anchored to the server clock (serverNow()).
   * This is the timestamp actually sent on an offline replay - it is not sent on a
   * live action, where the server stamps its own time and no device clock change
   * can spoof it. See queries.ts.
   */
  pressedAtServerMs: number;
  /**
   * The same press instant on the raw device clock. Used ONLY to measure how long
   * ago the press was, to tell a live submission from a delayed offline replay.
   * The device clock advances consistently over that short window even when the
   * server-clock offset is still settling, so unlike serverNow() it is not thrown
   * off by the offset changing mid-flow at cold start.
   */
  pressedAtDeviceMs: number;
};

/** Clock-in and clock-out both send a geofenced location. */
export type LocatedActionVariables = TimedActionVariables & { location: GeoPoint };

export type StartShiftVariables = LocatedActionVariables;
export type FinishShiftVariables = LocatedActionVariables;
export type BreakVariables = TimedActionVariables;

export async function listShifts(): Promise<Shift[]> {
  const data = await apiFetch<{ shifts: Shift[] }>(`/shifts/list?userId=${DEMO_USER_ID}`);
  return data.shifts;
}

/**
 * `datetime` is optional on purpose. Omitting it makes the server stamp the
 * clock-in with its own authoritative clock; passing it is reserved for replaying
 * a clock-in that was captured offline, where the press time is the best record
 * we have. See the anti-fraud note in the README.
 */
export async function startShift(input: {
  shiftId: string;
  location: GeoPoint;
  datetime?: string;
}): Promise<Shift> {
  const data = await apiFetch<{ shift: Shift }>(`/shifts/${input.shiftId}/start`, {
    method: 'POST',
    body: JSON.stringify({
      userId: DEMO_USER_ID,
      location: input.location,
      ...(input.datetime ? { datetime: input.datetime } : {}),
    }),
  });
  return data.shift;
}

/**
 * Clock out. Like `startShift`, a live finish omits `datetime` so the server
 * stamps its own clock; a replay sends the captured press time. The server
 * auto-closes any open break on finish.
 */
export async function finishShift(input: {
  shiftId: string;
  location: GeoPoint;
  datetime?: string;
}): Promise<Shift> {
  const data = await apiFetch<{ shift: Shift }>(`/shifts/${input.shiftId}/finish`, {
    method: 'POST',
    body: JSON.stringify({
      userId: DEMO_USER_ID,
      location: input.location,
      ...(input.datetime ? { datetime: input.datetime } : {}),
    }),
  });
  return data.shift;
}

/** Start a break. No location - the server only geofences clock-in and clock-out. */
export async function startBreak(input: { shiftId: string; datetime?: string }): Promise<Break> {
  const data = await apiFetch<{ break: Break }>(`/shifts/${input.shiftId}/break`, {
    method: 'POST',
    body: JSON.stringify({
      userId: DEMO_USER_ID,
      ...(input.datetime ? { datetime: input.datetime } : {}),
    }),
  });
  return data.break;
}

/** End the open break. */
export async function endBreak(input: { shiftId: string; datetime?: string }): Promise<Break> {
  const data = await apiFetch<{ break: Break }>(`/shifts/${input.shiftId}/break/end`, {
    method: 'POST',
    body: JSON.stringify({
      userId: DEMO_USER_ID,
      ...(input.datetime ? { datetime: input.datetime } : {}),
    }),
  });
  return data.break;
}

export async function listBreaks(shiftId: string): Promise<Break[]> {
  const data = await apiFetch<{ breaks: Break[] }>(`/shifts/${shiftId}/break/list`);
  return data.breaks;
}
