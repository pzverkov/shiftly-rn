import { breakEligibility, canFinishShift, type Break } from './breaks';
import { getShiftState } from './shift';
import { makeShift } from './testFixtures';

// The real API rules, imported straight from the API project in this repo.
const { assertCanStartShift, assertCanFinishShift, assertCanStartBreak, assertCanEndBreak } =
  require('../../../api/src/shifts/shifts-rules.pure.js');

/**
 * A differential test between the client's window logic and the server's.
 *
 * `getShiftState` exists so the UI can avoid offering an action the server would
 * reject. That guarantee is only worth anything while the two agree, and they are
 * written in different languages, in different directories, by different people.
 * The usual way this decays is silent: someone tunes a constant on one side and
 * the client starts showing a button that fails on press.
 *
 * So rather than restate the rules in assertions and hope, this sweeps a whole
 * day and asserts the two implementations make the same call at every minute.
 * If the server's rules change, this fails instead of the user.
 */

const SHIFT = makeShift({ startDate: '2026-07-16T14:00:00.000Z' });
const MINUTE = 60_000;

/** Standing exactly at the branch, so the geofence never confuses the comparison. */
const AT_BRANCH = SHIFT.branch.location;

function serverWouldAllowStart(now: Date): boolean {
  try {
    assertCanStartShift(SHIFT, now, AT_BRANCH);
    return true;
  } catch {
    return false;
  }
}

describe('getShiftState agrees with the server rules', () => {
  const start = new Date(SHIFT.startDate).getTime();
  const from = start - 60 * MINUTE;
  const to = new Date(SHIFT.endDate).getTime() + 60 * MINUTE;

  const disagreements: string[] = [];

  for (let now = from; now <= to; now += MINUTE) {
    const clientAllows = getShiftState(SHIFT, now).kind === 'clock-in-open';
    const serverAllows = serverWouldAllowStart(new Date(now));

    if (clientAllows !== serverAllows) {
      disagreements.push(
        `${new Date(now).toISOString()}: client=${clientAllows} server=${serverAllows}`,
      );
    }
  }

  it('makes the same call at every minute across the shift', () => {
    expect(disagreements).toEqual([]);
  });

  it('actually exercised the interesting cases, rather than agreeing on nothing', () => {
    // Guards against the sweep silently becoming a no-op - if both sides always
    // said "no", the test above would pass while proving nothing.
    expect(serverWouldAllowStart(new Date(start - 10 * MINUTE))).toBe(true);
    expect(serverWouldAllowStart(new Date(start - 20 * MINUTE))).toBe(false);
  });
});

// The same differential guard, extended to the clock-out and break rules. Each
// sweep isolates the one time-based edge the client mirrors, standing at the
// branch so the server's geofence never colours the comparison.

const STARTED = makeShift({ startDate: SHIFT.startDate, startedAt: SHIFT.startDate });

function serverAllows(fn: () => void): boolean {
  try {
    fn();
    return true;
  } catch {
    return false;
  }
}

describe('canFinishShift agrees with the server rules', () => {
  const end = new Date(STARTED.endDate).getTime();
  const from = new Date(STARTED.startDate).getTime();
  const to = end + 90 * MINUTE;

  const disagreements: string[] = [];
  for (let now = from; now <= to; now += MINUTE) {
    const client = canFinishShift(STARTED, now);
    const server = serverAllows(() => assertCanFinishShift(STARTED, new Date(now), AT_BRANCH));
    if (client !== server) {
      disagreements.push(`${new Date(now).toISOString()}: client=${client} server=${server}`);
    }
  }

  it('makes the same call at every minute across the shift', () => {
    expect(disagreements).toEqual([]);
  });

  it('exercised both sides of the finish grace edge', () => {
    expect(serverAllows(() => assertCanFinishShift(STARTED, new Date(end), AT_BRANCH))).toBe(true);
    expect(serverAllows(() => assertCanFinishShift(STARTED, new Date(end + 40 * MINUTE), AT_BRANCH))).toBe(false);
  });
});

describe('breakEligibility.canStart agrees with the server rules', () => {
  const start = new Date(STARTED.startDate).getTime();
  const from = start - 5 * MINUTE;
  const to = start + 30 * MINUTE;

  const disagreements: string[] = [];
  for (let now = from; now <= to; now += MINUTE) {
    const client = breakEligibility(STARTED, [], now).canStart;
    const server = serverAllows(() => assertCanStartBreak(STARTED, [], null, new Date(now)));
    if (client !== server) {
      disagreements.push(`${new Date(now).toISOString()}: client=${client} server=${server}`);
    }
  }

  it('makes the same call at every minute around the break gate', () => {
    expect(disagreements).toEqual([]);
  });

  it('exercised both sides of the two-minute gate', () => {
    expect(serverAllows(() => assertCanStartBreak(STARTED, [], null, new Date(start + 3 * MINUTE)))).toBe(true);
    expect(serverAllows(() => assertCanStartBreak(STARTED, [], null, new Date(start + MINUTE)))).toBe(false);
  });
});

describe('breakEligibility.canEnd agrees with the server rules', () => {
  const breakStartedAt = new Date(new Date(STARTED.startDate).getTime() + 30 * MINUTE).toISOString();
  const active: Break = { id: 'b1', shiftId: STARTED.id, startedAt: breakStartedAt, endedAt: null };
  const from = new Date(breakStartedAt).getTime() - MINUTE;
  const to = new Date(breakStartedAt).getTime() + 10 * MINUTE;

  const disagreements: string[] = [];
  for (let now = from; now <= to; now += MINUTE) {
    const client = breakEligibility(STARTED, [active], now).canEnd;
    const server = serverAllows(() => assertCanEndBreak(active, new Date(now)));
    if (client !== server) {
      disagreements.push(`${new Date(now).toISOString()}: client=${client} server=${server}`);
    }
  }

  it('makes the same call at every minute across the minimum break duration', () => {
    expect(disagreements).toEqual([]);
  });
});
