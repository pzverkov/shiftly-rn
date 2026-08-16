import { findActiveShift, getShiftState } from './shift';
import { at, makeShift } from './testFixtures';

/**
 * The window rules, tested at their edges.
 *
 * These mirror api/src/shifts/shifts-rules.pure.js. If the two ever disagree the user gets a
 * button that fails when pressed, so the boundaries are worth being exact about.
 *
 * Times are UTC and the suite pins TZ=UTC (see package.json), because
 * `getShiftState` compares *local* days - without a fixed zone these tests would
 * pass or fail depending on the machine running them.
 */

// Shift: 14:00 -> 22:00 UTC. Window opens 13:45. Finishable until 22:30.
const SHIFT = makeShift({ startDate: '2026-07-16T14:00:00.000Z' });

describe('getShiftState', () => {
  it('is upcoming before the window opens, and says how long is left', () => {
    const state = getShiftState(SHIFT, at('2026-07-16T13:44:00.000Z'));

    expect(state).toEqual({ kind: 'upcoming', msUntilWindow: 60_000 });
  });

  it('opens exactly 15 minutes before the start, not a moment later', () => {
    expect(getShiftState(SHIFT, at('2026-07-16T13:45:00.000Z'))).toEqual({
      kind: 'clock-in-open',
    });
  });

  it('is still closed one millisecond before the window', () => {
    const state = getShiftState(SHIFT, at('2026-07-16T13:44:59.999Z'));

    expect(state).toEqual({ kind: 'upcoming', msUntilWindow: 1 });
  });

  it('stays open after the shift has started, because the server only guards the early edge', () => {
    expect(getShiftState(SHIFT, at('2026-07-16T14:01:00.000Z'))).toEqual({
      kind: 'clock-in-open',
    });
  });

  it('is future on an earlier day, even inside the equivalent time window', () => {
    expect(getShiftState(SHIFT, at('2026-07-15T13:45:00.000Z'))).toEqual({ kind: 'future' });
  });

  it('is started once the server has recorded a clock-in', () => {
    const started = makeShift({
      startDate: SHIFT.startDate,
      startedAt: '2026-07-16T13:50:00.000Z',
    });

    expect(getShiftState(started, at('2026-07-16T16:00:00.000Z'))).toEqual({
      kind: 'started',
      startedAt: '2026-07-16T13:50:00.000Z',
    });
  });

  it('is finished once the server has recorded a clock-out', () => {
    const finished = makeShift({
      startDate: SHIFT.startDate,
      startedAt: '2026-07-16T13:50:00.000Z',
      finishedAt: '2026-07-16T22:00:00.000Z',
    });

    expect(getShiftState(finished, at('2026-07-16T22:05:00.000Z'))).toEqual({ kind: 'finished' });
  });

  it('is missed when the day passed without a clock-in', () => {
    expect(getShiftState(SHIFT, at('2026-07-17T09:00:00.000Z'))).toEqual({ kind: 'missed' });
  });

  it('is missed once the shift can no longer be finished, even on the same day', () => {
    // 22:30 is the last moment the server would accept a finish; past it there is
    // nothing left to do with this shift.
    expect(getShiftState(SHIFT, at('2026-07-16T22:31:00.000Z'))).toEqual({ kind: 'missed' });
  });

  it('treats a started shift past the finish grace period as finished, not still running', () => {
    const started = makeShift({
      startDate: SHIFT.startDate,
      startedAt: '2026-07-16T13:50:00.000Z',
    });

    expect(getShiftState(started, at('2026-07-16T22:31:00.000Z'))).toEqual({ kind: 'finished' });
  });
});

describe('findActiveShift', () => {
  const today = makeShift({ id: 'today', startDate: '2026-07-16T14:00:00.000Z' });
  const tomorrow = makeShift({ id: 'tomorrow', startDate: '2026-07-17T09:00:00.000Z' });

  it('picks the soonest actionable shift', () => {
    const active = findActiveShift([tomorrow, today], at('2026-07-16T13:00:00.000Z'));

    expect(active?.id).toBe('today');
  });

  it('prefers a shift in progress over one that is merely startable', () => {
    // Both are live at once only if a rota overlaps, but the started one is the
    // one the user is standing in, so it must win regardless of start times.
    const running = makeShift({
      id: 'running',
      startDate: '2026-07-16T08:00:00.000Z',
      startedAt: '2026-07-16T08:00:00.000Z',
    });

    const active = findActiveShift([today, running], at('2026-07-16T13:50:00.000Z'));

    expect(active?.id).toBe('running');
  });

  it('returns null when everything is done', () => {
    expect(findActiveShift([today], at('2026-07-18T00:00:00.000Z'))).toBeNull();
  });

  it('ignores days far ahead but still surfaces them as upcoming work', () => {
    const active = findActiveShift([tomorrow], at('2026-07-16T13:00:00.000Z'));

    // 'future' is not actionable, so nothing is foregrounded today.
    expect(active).toBeNull();
  });
});
