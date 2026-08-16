import { MutationObserver, QueryClientProvider, onlineManager } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react-native';
import { createElement, type ReactNode } from 'react';

import { createQueryClient, shiftKeys } from './queries';
import type { StartShiftVariables } from './shifts';
import type { Shift } from '../domain/shift';
import {
  cardSyncState,
  pulseCounts,
  summarize,
  useQueueSummary,
  useSettlePulse,
  type MutationView,
} from './syncStatus';
import { makeShift } from '../domain/testFixtures';

const view = (over: Partial<MutationView> = {}): MutationView => ({
  status: 'pending',
  isPaused: true,
  shiftId: 'shift-1',
  ...over,
});

describe('summarize', () => {
  it('counts paused mutations as queued and in-flight ones as syncing', () => {
    expect(
      summarize([
        view({ isPaused: true }),
        view({ isPaused: true, shiftId: 'shift-2' }),
        view({ isPaused: false }),
      ]),
    ).toEqual({ queued: 2, syncing: 1 });
  });

  it('ignores settled mutations - a lingering success is neither queued nor syncing', () => {
    expect(summarize([view({ status: 'success', isPaused: false }), view({ status: 'error' })])).toEqual({
      queued: 0,
      syncing: 0,
    });
  });

  it('is zero for an empty cache', () => {
    expect(summarize([])).toEqual({ queued: 0, syncing: 0 });
  });
});

describe('cardSyncState', () => {
  it('reports idle when no pending write belongs to the shift', () => {
    expect(cardSyncState([view({ shiftId: 'other' })], 'shift-1')).toBe('idle');
  });

  it('reports queued when the shift has only a paused write', () => {
    expect(cardSyncState([view({ isPaused: true })], 'shift-1')).toBe('queued');
  });

  it('lets syncing win over queued so a card with one write on the wire reads as progressing', () => {
    // A finish in flight, a break still paused behind it: the card is making progress.
    expect(cardSyncState([view({ isPaused: false }), view({ isPaused: true })], 'shift-1')).toBe(
      'syncing',
    );
  });

  it('ignores a settled write for the shift', () => {
    expect(cardSyncState([view({ status: 'success', isPaused: false })], 'shift-1')).toBe('idle');
  });
});

describe('pulseCounts', () => {
  it('counts pending as active and success as succeeded, ignoring error and idle', () => {
    expect(
      pulseCounts([
        view({ status: 'pending' }),
        view({ status: 'success' }),
        view({ status: 'error' }),
        view({ status: 'idle' }),
      ]),
    ).toEqual({ active: 1, succeeded: 1 });
  });

  it('scopes to one shift when a shiftId is given', () => {
    expect(
      pulseCounts(
        [view({ status: 'success', shiftId: 'a' }), view({ status: 'success', shiftId: 'b' })],
        'a',
      ),
    ).toEqual({ active: 0, succeeded: 1 });
  });
});

describe('useSettlePulse', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  type Props = { active: number; succeeded: number };
  const pulse = ({ active, succeeded }: Props) => useSettlePulse(active, succeeded, 2500);

  it('does not pulse for a queue that was empty all along', async () => {
    const { result } = await renderHook(pulse, { initialProps: { active: 0, succeeded: 0 } });
    expect(result.current).toBe(false);
  });

  it('pulses once when the queue drains by succeeding, then clears itself', async () => {
    const { result, rerender } = await renderHook(pulse, {
      initialProps: { active: 1, succeeded: 0 },
    });
    expect(result.current).toBe(false);

    // The write landed: active falls to zero and a success appears in the same drain.
    await rerender({ active: 0, succeeded: 1 });
    expect(result.current).toBe(true);

    await act(async () => jest.advanceTimersByTime(2500));
    expect(result.current).toBe(false);
  });

  it('does NOT pulse when the queue drains without a new success (a rejection)', async () => {
    // The bug this guards: a queued write that reconnects and is rejected terminally
    // drops active to zero with no new success, and must not flash "Synced".
    const { result, rerender } = await renderHook(pulse, {
      initialProps: { active: 1, succeeded: 0 },
    });

    await rerender({ active: 0, succeeded: 0 });
    expect(result.current).toBe(false);
  });

  it('does NOT pulse on a re-pause, where active never reaches zero', async () => {
    // Signal drops mid-flight: syncing -> paused keeps a write pending, so active
    // stays above zero and there is no drain to celebrate.
    const { result, rerender } = await renderHook(pulse, {
      initialProps: { active: 1, succeeded: 0 },
    });

    await rerender({ active: 1, succeeded: 0 });
    expect(result.current).toBe(false);
  });

  it('cancels a running pulse if the queue re-arms, so a second drain gets a clean pulse', async () => {
    const { result, rerender } = await renderHook(pulse, {
      initialProps: { active: 1, succeeded: 0 },
    });

    await rerender({ active: 0, succeeded: 1 });
    expect(result.current).toBe(true);

    // Re-armed before the pulse finished: it must clear now, not ride the old timer.
    await rerender({ active: 1, succeeded: 1 });
    expect(result.current).toBe(false);
  });
});

/**
 * The one wiring test the pure functions cannot cover: that the mutation-cache
 * `select` reads the fields it thinks it does. A rename of `isPaused`, or variables
 * arriving without a `shiftId`, would leave the queue permanently reading empty and
 * nothing on screen would throw - so this drives a real paused mutation end to end.
 */
describe('useQueueSummary against a real paused mutation', () => {
  const SHIFT = makeShift({ id: 'shift-1' });
  const startVars = {
    shiftId: SHIFT.id,
    location: SHIFT.branch.location,
    pressedAtServerMs: 1_000,
    pressedAtDeviceMs: 1_000,
  };

  afterEach(() => onlineManager.setOnline(true));

  it('sees a clock-in made offline as one queued action', async () => {
    onlineManager.setOnline(false);
    const client = createQueryClient();

    // Pause a real start-shift through its registered defaults, before rendering,
    // so the hook only ever reads an already-settled paused state.
    const observer = new MutationObserver<Shift, Error, StartShiftVariables>(client, {
      mutationKey: shiftKeys.start(),
    });
    await act(async () => {
      observer.mutate(startVars).catch(() => {});
    });

    const wrapper = ({ children }: { children: ReactNode }) =>
      createElement(QueryClientProvider, { client }, children);
    const { result, unmount } = await renderHook(() => useQueueSummary(), { wrapper });

    await waitFor(() => expect(result.current).toEqual({ queued: 1, syncing: 0 }));

    // Drop the still-paused mutation before afterEach goes back online, so it never
    // resumes into a real fetch and updates a torn-down tree.
    unmount();
    client.getMutationCache().clear();
  });
});
