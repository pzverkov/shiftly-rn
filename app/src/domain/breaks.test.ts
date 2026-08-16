import {
  breakEligibility,
  canFinishShift,
  getActiveBreak,
  MAX_BREAKS_PER_SHIFT,
  MIN_MINUTES_BEFORE_BREAK,
  MIN_MINUTES_BREAK_DURATION,
  type Break,
} from './breaks';
import { SHIFT_FINISH_GRACE_MINUTES } from './shift';
import { at, makeShift } from './testFixtures';

const MINUTE = 60_000;
const STARTED_AT = '2026-07-16T14:00:00.000Z';
const started = makeShift({ startDate: STARTED_AT, startedAt: STARTED_AT });

function makeBreak(startedAt: string, endedAt: string | null = null): Break {
  return { id: `break-${startedAt}`, shiftId: started.id, startedAt, endedAt };
}

describe('getActiveBreak', () => {
  it('returns the one open break', () => {
    const open = makeBreak('2026-07-16T15:00:00.000Z');
    const closed = makeBreak('2026-07-16T14:30:00.000Z', '2026-07-16T14:40:00.000Z');
    expect(getActiveBreak([closed, open])).toBe(open);
  });

  it('returns null when every break is closed', () => {
    const closed = makeBreak('2026-07-16T14:30:00.000Z', '2026-07-16T14:40:00.000Z');
    expect(getActiveBreak([closed])).toBeNull();
    expect(getActiveBreak([])).toBeNull();
  });
});

describe('canFinishShift', () => {
  it('is false before the shift starts', () => {
    const scheduled = makeShift({ startDate: STARTED_AT });
    expect(canFinishShift(scheduled, at(STARTED_AT))).toBe(false);
  });

  it('is true for a started shift within the grace period', () => {
    expect(canFinishShift(started, at('2026-07-16T18:00:00.000Z'))).toBe(true);
    const end = new Date(started.endDate).getTime();
    expect(canFinishShift(started, end + SHIFT_FINISH_GRACE_MINUTES * MINUTE)).toBe(true);
  });

  it('is false once the finish grace period has lapsed', () => {
    const end = new Date(started.endDate).getTime();
    expect(canFinishShift(started, end + SHIFT_FINISH_GRACE_MINUTES * MINUTE + MINUTE)).toBe(false);
  });

  it('is false for an already finished shift', () => {
    const finished = makeShift({ startDate: STARTED_AT, startedAt: STARTED_AT, finishedAt: '2026-07-16T18:00:00.000Z' });
    expect(canFinishShift(finished, at('2026-07-16T18:01:00.000Z'))).toBe(false);
  });
});

describe('breakEligibility - starting a break', () => {
  const justAfterGate = at(STARTED_AT) + MIN_MINUTES_BEFORE_BREAK * MINUTE;

  it('is blocked as too-soon in the first two minutes, then enables at the boundary', () => {
    expect(breakEligibility(started, [], justAfterGate - MINUTE)).toEqual({
      canStart: false,
      canEnd: false,
      startBlockedReason: 'too-soon',
    });
    expect(breakEligibility(started, [], justAfterGate)).toEqual({ canStart: true, canEnd: false });
  });

  it('is blocked as limit-reached once both breaks are used', () => {
    const twoBreaks = [
      makeBreak('2026-07-16T14:10:00.000Z', '2026-07-16T14:20:00.000Z'),
      makeBreak('2026-07-16T15:10:00.000Z', '2026-07-16T15:20:00.000Z'),
    ];
    expect(twoBreaks.length).toBe(MAX_BREAKS_PER_SHIFT);
    expect(breakEligibility(started, twoBreaks, at('2026-07-16T16:00:00.000Z'))).toEqual({
      canStart: false,
      canEnd: false,
      startBlockedReason: 'limit-reached',
    });
  });

  it('cannot start a second break while one is active', () => {
    const active = [makeBreak('2026-07-16T15:00:00.000Z')];
    const result = breakEligibility(started, active, at('2026-07-16T15:05:00.000Z'));
    expect(result.canStart).toBe(false);
    expect(result.startBlockedReason).toBeUndefined();
  });

  it('cannot start on a shift that never started or has finished', () => {
    const scheduled = makeShift({ startDate: STARTED_AT });
    expect(breakEligibility(scheduled, [], at('2026-07-16T14:05:00.000Z')).canStart).toBe(false);
    const finished = makeShift({ startDate: STARTED_AT, startedAt: STARTED_AT, finishedAt: '2026-07-16T18:00:00.000Z' });
    expect(breakEligibility(finished, [], at('2026-07-16T18:05:00.000Z')).canStart).toBe(false);
  });
});

describe('breakEligibility - ending a break', () => {
  const breakStart = '2026-07-16T15:00:00.000Z';
  const active = [makeBreak(breakStart)];
  const earliestEnd = at(breakStart) + MIN_MINUTES_BREAK_DURATION * MINUTE;

  it('cannot end before the two-minute minimum, then enables at the boundary', () => {
    expect(breakEligibility(started, active, earliestEnd - MINUTE).canEnd).toBe(false);
    expect(breakEligibility(started, active, earliestEnd).canEnd).toBe(true);
  });

  it('cannot end when no break is active', () => {
    const closed = [makeBreak(breakStart, '2026-07-16T15:10:00.000Z')];
    expect(breakEligibility(started, closed, at('2026-07-16T16:00:00.000Z')).canEnd).toBe(false);
  });
});
