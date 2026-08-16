import { onlineManager } from '@tanstack/react-query';

import { createQueryClient, shiftKeys } from './queries';
import { ApiError } from './errors';
import type { BreakVariables, FinishShiftVariables, StartShiftVariables } from './shifts';
import { makeShift } from '../domain/testFixtures';
import { resetServerClock, sampleServerDate } from '../time/serverClock';
import type { Break } from '../domain/breaks';
import type { Shift } from '../domain/shift';

/**
 * The clock-in mutation, driven through a real QueryClient against a mocked fetch.
 *
 * This is the part of the app most likely to misbehave in ways nobody notices in
 * a demo: a retry that double-clocks someone in, an error shown for a request
 * that actually succeeded, or a queued clock-in that replays with the wrong time.
 * None of those throw. They just quietly record the wrong thing.
 */

const SHIFT = makeShift({ id: 'shift-1', startDate: '2026-07-16T14:00:00.000Z' });

// The startedAt the server returns in its response (whatever clock it used).
const STARTED_AT = '2026-07-16T13:50:00.000Z';

// A press "just now" (device time) reads as a live submission; a press minutes ago
// reads as an offline replay. Classification is on the device clock, so these set
// pressedAtDeviceMs; pressedAtServerMs is only what a replay actually sends.
const liveVariables = (): StartShiftVariables => ({
  shiftId: SHIFT.id,
  location: SHIFT.branch.location,
  pressedAtServerMs: Date.now(),
  pressedAtDeviceMs: Date.now(),
});

const replayVariables = (pressedAtServerMs: number): StartShiftVariables => ({
  shiftId: SHIFT.id,
  location: SHIFT.branch.location,
  pressedAtServerMs,
  pressedAtDeviceMs: pressedAtServerMs,
});

function jsonResponse(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: { get: () => new Date('2026-07-16T13:50:00.000Z').toUTCString() },
    json: async () => body,
  } as unknown as Response;
}

function errorResponse(code: string, message = 'nope', status = 409, details?: unknown): Response {
  return jsonResponse({ error: { code, message, details } }, status);
}

function sentBody(callIndex = 0): { userId: string; location: unknown; datetime?: string } {
  return JSON.parse(fetchMock.mock.calls[callIndex][1].body);
}

/** The request path fetch was called with, e.g. '/shifts/shift-1/break'. */
function requestedPath(callIndex = 0): string {
  const url = fetchMock.mock.calls[callIndex][0] as string;
  return url.replace(/^https?:\/\/[^/]+/, '');
}

const fetchMock = jest.fn();

let client: ReturnType<typeof createQueryClient>;

/** Runs a mutation the same way the app does: through the client's defaults. */
function run<TData, TVars>(mutationKey: readonly unknown[], variables: TVars): Promise<TData> {
  return client
    .getMutationCache()
    .build<TData, Error, TVars, unknown>(client, { mutationKey: [...mutationKey] })
    .execute(variables);
}

function runStartShift(variables = liveVariables()) {
  return run<Shift, StartShiftVariables>(shiftKeys.start(), variables);
}

const breakVariables = (): BreakVariables => ({
  shiftId: SHIFT.id,
  pressedAtServerMs: Date.now(),
  pressedAtDeviceMs: Date.now(),
});

beforeEach(() => {
  jest.clearAllMocks();
  resetServerClock();
  global.fetch = fetchMock as unknown as typeof fetch;
  onlineManager.setOnline(true);
  client = createQueryClient();
});

afterEach(() => {
  // Every cached query and mutation arms a garbage-collection timer - ours run to
  // 24h for queries and React Query's default 5min for mutations. In the app that
  // is the point; here it holds the jest worker open long after the assertions
  // are done.
  //
  // `clear()` alone is not enough: it drops the entries from the cache but never
  // calls destroy(), so the timers stay armed with nothing left to collect.
  client.getQueryCache().getAll().forEach((query) => query.destroy());
  client.getMutationCache().getAll().forEach((mutation) => mutation.destroy());
  client.clear();
});

describe('clocking in', () => {
  it('sends no datetime on a live submission, so the server stamps its own clock', async () => {
    // The anti-fraud property: a device clock or timezone change cannot move the
    // recorded time, because the client never supplies it on the live path.
    fetchMock.mockResolvedValue(jsonResponse({ shift: { ...SHIFT, startedAt: STARTED_AT } }));

    await runStartShift();

    const body = sentBody();
    expect(body.datetime).toBeUndefined();
    expect(body.location).toEqual(SHIFT.branch.location);
    expect(body.userId).toBe('user-demo');
  });

  it('updates the cached list from the server response', async () => {
    const started = { ...SHIFT, startedAt: STARTED_AT };
    fetchMock.mockResolvedValue(jsonResponse({ shift: started }));

    client.setQueryData<Shift[]>(shiftKeys.list(), [SHIFT]);

    const result = await runStartShift();

    expect(result.startedAt).toBe(STARTED_AT);
  });

  it('stays live when the clock offset jumps after the press (the cold-start bug)', async () => {
    // Pressed while unsynced, then a live Date header moves serverNow() by +10min -
    // the offset-based classification would have misread this as a delayed replay and
    // backdated it. The device-clock delta must keep it on the live, server-stamped path.
    const now = Date.now();
    sampleServerDate(new Date(now + 10 * 60_000).toUTCString());
    fetchMock.mockResolvedValue(jsonResponse({ shift: { ...SHIFT, startedAt: STARTED_AT } }));

    await runStartShift({
      shiftId: SHIFT.id,
      location: SHIFT.branch.location,
      pressedAtServerMs: now,
      pressedAtDeviceMs: now,
    });

    expect(sentBody().datetime).toBeUndefined();
  });

  it('writes the cache from the mutation defaults, not a per-call callback', async () => {
    // runStartShift builds the mutation with only a mutationKey - the exact shape
    // a mutation restored from disk resumes into, with no hook onSuccess attached.
    // If the cache write lived on the hook instead of the defaults, a resumed
    // clock-in would succeed on the server while the list still showed it as not
    // started. So assert the cache is updated purely via the defaults.
    fetchMock.mockResolvedValue(jsonResponse({ shift: { ...SHIFT, startedAt: STARTED_AT } }));
    client.setQueryData<Shift[]>(shiftKeys.list(), [SHIFT]);

    await runStartShift();

    expect(client.getQueryData<Shift[]>(shiftKeys.list())?.[0].startedAt).toBe(STARTED_AT);
  });
});

describe('reconciling a conflict', () => {
  /**
   * The load-bearing case. A retry, a double tap, or an offline replay can all
   * send a start the server has already applied. It answers SHIFT_ALREADY_STARTED,
   * which is not a failure - it means the world already agrees with the user. This
   * is also what makes retrying a POST defensible at all.
   */
  it('treats SHIFT_ALREADY_STARTED as success by refetching the truth', async () => {
    const alreadyStarted = { ...SHIFT, startedAt: '2026-07-16T13:49:00.000Z' };
    fetchMock
      .mockResolvedValueOnce(errorResponse('SHIFT_ALREADY_STARTED'))
      .mockResolvedValueOnce(jsonResponse({ shifts: [alreadyStarted] }));

    const result = await runStartShift();

    // The user sees a started shift, not an error - and the time is the server's
    // record of the original clock-in, not our second attempt.
    expect(result.startedAt).toBe('2026-07-16T13:49:00.000Z');
  });

  it('rethrows when the refetch cannot explain the conflict', async () => {
    // The server says already-started but the shift is not in the list. Something
    // is genuinely wrong; inventing a success would hide it.
    fetchMock
      .mockResolvedValueOnce(errorResponse('SHIFT_ALREADY_STARTED'))
      .mockResolvedValueOnce(jsonResponse({ shifts: [] }));

    await expect(runStartShift()).rejects.toBeInstanceOf(ApiError);
  });

  it('does not swallow a genuine rejection as a reconcile', async () => {
    fetchMock.mockResolvedValue(errorResponse('SHIFT_OUT_OF_RANGE', 'Too far'));

    await expect(runStartShift()).rejects.toMatchObject({
      code: 'SHIFT_OUT_OF_RANGE',
    });
  });
});

describe('retry discipline', () => {
  it('never retries a business rejection', async () => {
    // Retrying a rule the server already applied is pointless at best; on a
    // non-idempotent endpoint it is how you act twice.
    fetchMock.mockResolvedValue(errorResponse('SHIFT_START_TOO_EARLY'));

    await expect(runStartShift()).rejects.toMatchObject({
      code: 'SHIFT_START_TOO_EARLY',
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('does not retry a validation error', async () => {
    fetchMock.mockResolvedValue(errorResponse('VALIDATION_ERROR', 'bad body', 400));

    await expect(runStartShift()).rejects.toMatchObject({ status: 400 });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('retries a dropped connection and succeeds when it comes back', async () => {
    fetchMock
      .mockRejectedValueOnce(new TypeError('Network request failed'))
      .mockResolvedValueOnce(jsonResponse({ shift: { ...SHIFT, startedAt: STARTED_AT } }));

    const result = await runStartShift();

    expect(result.startedAt).toBe(STARTED_AT);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('keeps a fast retry on the live path, so every attempt lets the server stamp', async () => {
    // A transport retry happens seconds after the press, so it is still live - no
    // attempt should smuggle a client datetime in.
    fetchMock
      .mockRejectedValueOnce(new TypeError('Network request failed'))
      .mockResolvedValueOnce(jsonResponse({ shift: SHIFT }));

    await runStartShift();

    const datetimes = fetchMock.mock.calls.map((call) => JSON.parse(call[1].body).datetime);
    expect(datetimes).toEqual([undefined, undefined]);
  });
});

describe('offline', () => {
  it('pauses instead of failing, then replays the original press time on reconnect', async () => {
    // Pressed five minutes ago, then queued offline: past the live window, so this
    // resumes as a replay and DOES send the captured press time - the server clock
    // at reconnect would record the wrong moment.
    const pressedAtServerMs = Date.now() - 5 * 60_000;
    onlineManager.setOnline(false);

    const pending = runStartShift(replayVariables(pressedAtServerMs));

    // Nothing must hit the network while there is no radio.
    expect(fetchMock).not.toHaveBeenCalled();

    fetchMock.mockResolvedValue(jsonResponse({ shift: { ...SHIFT, startedAt: STARTED_AT } }));
    onlineManager.setOnline(true);
    await client.resumePausedMutations();
    await pending;

    // The clock-in is recorded at the moment the user pressed the button, not the
    // moment the signal came back.
    expect(sentBody().datetime).toBe(new Date(pressedAtServerMs).toISOString());
  });
});

const FINISHED_AT = '2026-07-16T22:00:00.000Z';

function runFinishShift(variables: FinishShiftVariables = liveVariables()) {
  return run<Shift, FinishShiftVariables>(shiftKeys.finish(), variables);
}

describe('clocking out', () => {
  it('sends no datetime on a live finish, so the server stamps its own clock', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ shift: { ...SHIFT, finishedAt: FINISHED_AT } }));

    await runFinishShift();

    expect(sentBody().datetime).toBeUndefined();
    expect(requestedPath()).toBe(`/shifts/${SHIFT.id}/finish`);
  });

  it('replays the captured press time when finished offline', async () => {
    const pressedAtServerMs = Date.now() - 5 * 60_000;
    fetchMock.mockResolvedValue(jsonResponse({ shift: { ...SHIFT, finishedAt: FINISHED_AT } }));

    await runFinishShift({
      shiftId: SHIFT.id,
      location: SHIFT.branch.location,
      pressedAtServerMs,
      pressedAtDeviceMs: pressedAtServerMs,
    });

    expect(sentBody().datetime).toBe(new Date(pressedAtServerMs).toISOString());
  });

  it('treats SHIFT_ALREADY_FINISHED as success by refetching the truth', async () => {
    const finished = { ...SHIFT, finishedAt: FINISHED_AT };
    fetchMock
      .mockResolvedValueOnce(errorResponse('SHIFT_ALREADY_FINISHED'))
      .mockResolvedValueOnce(jsonResponse({ shifts: [finished] }));

    const result = await runFinishShift();

    expect(result.finishedAt).toBe(FINISHED_AT);
  });

  it('writes the finished shift into the cached list and clears the breaks cache', async () => {
    const finished = { ...SHIFT, finishedAt: FINISHED_AT };
    fetchMock.mockResolvedValue(jsonResponse({ shift: finished }));
    client.setQueryData<Shift[]>(shiftKeys.list(), [SHIFT]);
    client.setQueryData<Break[]>(shiftKeys.breaks(SHIFT.id), [
      { id: 'b1', shiftId: SHIFT.id, startedAt: '2026-07-16T15:00:00.000Z', endedAt: null },
    ]);

    await runFinishShift();

    expect(client.getQueryData<Shift[]>(shiftKeys.list())?.[0].finishedAt).toBe(FINISHED_AT);
    // Invalidated, so the stale open break is refetched rather than shown as active.
    expect(client.getQueryState(shiftKeys.breaks(SHIFT.id))?.isInvalidated).toBe(true);
  });
});

describe('breaks', () => {
  const openBreak: Break = {
    id: 'break-1',
    shiftId: SHIFT.id,
    startedAt: '2026-07-16T15:00:00.000Z',
    endedAt: null,
  };

  function runStartBreak(variables = breakVariables()) {
    return run<Break, BreakVariables>(shiftKeys.startBreak(), variables);
  }
  function runEndBreak(variables = breakVariables()) {
    return run<Break, BreakVariables>(shiftKeys.endBreak(), variables);
  }

  it('starts a break with no location and seeds the breaks cache', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ break: openBreak }));

    await runStartBreak();

    expect(sentBody().location).toBeUndefined();
    expect(requestedPath()).toBe(`/shifts/${SHIFT.id}/break`);
    expect(client.getQueryData<Break[]>(shiftKeys.breaks(SHIFT.id))).toEqual([openBreak]);
  });

  it('reconciles BREAK_ALREADY_ACTIVE by returning the refetched active break', async () => {
    fetchMock
      .mockResolvedValueOnce(errorResponse('BREAK_ALREADY_ACTIVE'))
      .mockResolvedValueOnce(jsonResponse({ breaks: [openBreak] }));

    const result = await runStartBreak();

    expect(result).toEqual(openBreak);
  });

  it('ends a break and replaces it in the cache with the closed one', async () => {
    const closed: Break = { ...openBreak, endedAt: '2026-07-16T15:20:00.000Z' };
    fetchMock.mockResolvedValue(jsonResponse({ break: closed }));
    client.setQueryData<Break[]>(shiftKeys.breaks(SHIFT.id), [openBreak]);

    await runEndBreak();

    expect(client.getQueryData<Break[]>(shiftKeys.breaks(SHIFT.id))).toEqual([closed]);
  });

  it('reconciles BREAK_NOT_ACTIVE by returning the refetched most-recent break', async () => {
    const closed: Break = { ...openBreak, endedAt: '2026-07-16T15:20:00.000Z' };
    fetchMock
      .mockResolvedValueOnce(errorResponse('BREAK_NOT_ACTIVE'))
      .mockResolvedValueOnce(jsonResponse({ breaks: [closed] }));

    const result = await runEndBreak();

    expect(result).toEqual(closed);
  });

  it('does not retry BREAK_LIMIT_REACHED - it is terminal', async () => {
    fetchMock.mockResolvedValue(errorResponse('BREAK_LIMIT_REACHED', 'Two breaks already', 409));

    await expect(runStartBreak()).rejects.toMatchObject({ code: 'BREAK_LIMIT_REACHED' });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

describe('ordered offline replay', () => {
  it('replays a queued break before the clock-out that auto-closes it', async () => {
    // The FIFO-scope guarantee: both writes share one scope, so on reconnect they
    // resume in the order queued. If the finish raced ahead, the server would
    // auto-close a break that was never recorded.
    onlineManager.setOnline(false);

    const brk: Break = {
      id: 'break-1',
      shiftId: SHIFT.id,
      startedAt: '2026-07-16T15:00:00.000Z',
      endedAt: null,
    };
    const pressedAtServerMs = Date.now() - 5 * 60_000;

    const breakPending = run<Break, BreakVariables>(shiftKeys.startBreak(), {
      shiftId: SHIFT.id,
      pressedAtServerMs,
      pressedAtDeviceMs: pressedAtServerMs,
    });
    const finishPending = run<Shift, FinishShiftVariables>(shiftKeys.finish(), {
      shiftId: SHIFT.id,
      location: SHIFT.branch.location,
      pressedAtServerMs,
      pressedAtDeviceMs: pressedAtServerMs,
    });

    expect(fetchMock).not.toHaveBeenCalled();

    fetchMock.mockImplementation((url: string) =>
      Promise.resolve(
        url.endsWith('/finish')
          ? jsonResponse({ shift: { ...SHIFT, finishedAt: FINISHED_AT } })
          : jsonResponse({ break: brk }),
      ),
    );

    onlineManager.setOnline(true);
    await client.resumePausedMutations();
    await Promise.all([breakPending, finishPending]);

    const paths = fetchMock.mock.calls.map((call) => call[0] as string);
    const breakIndex = paths.findIndex((p) => p.endsWith('/break'));
    const finishIndex = paths.findIndex((p) => p.endsWith('/finish'));
    expect(breakIndex).toBeGreaterThanOrEqual(0);
    expect(finishIndex).toBeGreaterThan(breakIndex);
  });
});
