import { renderHook, act } from '@testing-library/react-native';
import { AppState } from 'react-native';

import { useNow } from './useNow';
import { resetServerClock, sampleServerDate } from './serverClock';

/**
 * The adaptive clock behind the countdown.
 *
 * Its whole reason to exist is what a naive `setInterval` gets wrong on a phone in
 * a pocket: it must tick fast only when something is imminent, never accumulate
 * ticks (they are throttled when backgrounded), re-read the instant the app returns
 * to the foreground, and re-read the instant the first server sample corrects the
 * clock. Each of those is asserted here with fake timers.
 */

const BASE = new Date('2026-07-16T14:00:00.000Z').getTime();

let appStateHandler: (status: string) => void = () => {};

beforeEach(() => {
  resetServerClock();
  jest.spyOn(AppState, 'addEventListener').mockImplementation((_event, handler) => {
    appStateHandler = handler as (status: string) => void;
    return { remove: jest.fn() } as unknown as ReturnType<typeof AppState.addEventListener>;
  });
  jest.useFakeTimers().setSystemTime(BASE);
});

afterEach(() => {
  jest.useRealTimers();
  jest.restoreAllMocks();
});

it('ticks every second when the target is within the fast threshold', async () => {
  const { result } = await renderHook(() => useNow(BASE + 30_000));
  expect(result.current).toBe(BASE);

  await act(async () => {
    jest.advanceTimersByTime(1_000);
  });

  expect(result.current).toBe(BASE + 1_000);
});

it('ticks only at the slow interval when nothing is imminent', async () => {
  const { result } = await renderHook(() => useNow(BASE + 600_000));

  // A second passes: too far out for the fast tick, so nothing updates.
  await act(async () => {
    jest.advanceTimersByTime(1_000);
  });
  expect(result.current).toBe(BASE);

  // At 30s the slow tick lands.
  await act(async () => {
    jest.advanceTimersByTime(29_000);
  });
  expect(result.current).toBe(BASE + 30_000);
});

it('re-reads immediately on returning to the foreground, without waiting for a tick', async () => {
  const { result } = await renderHook(() => useNow(null));

  // Time passed while backgrounded. Advancing by less than the slow interval moves
  // the clock without firing a tick - so nothing has updated the value yet.
  jest.advanceTimersByTime(5_000);
  expect(result.current).toBe(BASE);

  await act(async () => {
    appStateHandler('active');
  });
  expect(result.current).toBe(BASE + 5_000);
});

it('re-reads the moment the server-clock offset lands', async () => {
  const { result } = await renderHook(() => useNow(null));

  // The first server sample moves the offset by two minutes; the countdown must
  // correct at once rather than at the next slow tick, up to 30s away.
  await act(async () => {
    sampleServerDate(new Date(BASE + 120_000).toUTCString());
  });

  expect(result.current).toBe(BASE + 120_000);
});
