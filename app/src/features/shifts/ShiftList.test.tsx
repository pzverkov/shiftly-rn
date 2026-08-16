import { act, render, screen } from '@testing-library/react-native';
import { SafeAreaProvider, type Metrics } from 'react-native-safe-area-context';

import { ShiftList, nextWindowTarget } from './ShiftList';
import { makeShift } from '../../domain/testFixtures';
import { resetServerClock } from '../../time/serverClock';

/**
 * Regression guard for the fast tick that never engaged.
 *
 * The old code memoised this target on `[sorted]` and read `Date.now()`, so once
 * no shift was actionable at mount the target froze at null and the countdown for
 * a shift that only *became* upcoming later crawled at the 30s slow tick. These
 * assert the target is a pure function of `now`, recomputed each render.
 */
describe('nextWindowTarget', () => {
  // Window opens at 13:45 for a 14:00 shift.
  const shift = makeShift({ startDate: '2026-07-16T14:00:00.000Z' });
  const windowOpensAt = new Date('2026-07-16T13:45:00.000Z').getTime();

  it('is null when nothing is actionable yet - a shift on a later day', () => {
    const nextDay = makeShift({ id: 'later', startDate: '2026-07-18T09:00:00.000Z' });
    expect(nextWindowTarget([nextDay], new Date('2026-07-16T12:00:00.000Z').getTime())).toBeNull();
  });

  it('returns the absolute window-open time once a shift is upcoming', () => {
    // The exact case the freeze broke: the shift was not actionable a moment ago
    // and is now. The target must appear, not stay stuck at null.
    expect(nextWindowTarget([shift], new Date('2026-07-16T13:44:00.000Z').getTime())).toBe(
      windowOpensAt,
    );
  });

  it('is null while the window is already open, since there is nothing to count to', () => {
    expect(nextWindowTarget([shift], new Date('2026-07-16T13:50:00.000Z').getTime())).toBeNull();
  });
});

/**
 * Note `render` and `act` are awaited throughout: React Testing Library v14
 * turned them async, because React 19's test renderer needs an async act. A
 * forgotten await here does not fail loudly - it returns a pending promise and
 * the assertions run against nothing.
 */

jest.mock('./ShiftCard', () => {
  const { Text } = require('react-native');
  const { memo } = require('react');

  // Stands in for the real card and counts its renders. Memoised exactly like the
  // real one, so the boundary under test is the real boundary.
  const Spy = memo(({ shift, now }: { shift: { id: string }; now: number }) => {
    mockRenderCounts.set(shift.id, (mockRenderCounts.get(shift.id) ?? 0) + 1);
    return <Text testID={`card-${shift.id}`}>{now}</Text>;
  });

  Spy.displayName = 'ShiftCardSpy';

  return { ShiftCard: Spy };
});

const mockRenderCounts = new Map<string, number>();

// 30 seconds before the window opens at 13:45 - inside the threshold where the
// clock ticks per-second. Exactly 60s out would still be on the slow tick.
const NOW = new Date('2026-07-16T13:44:30.000Z').getTime();

const IMMINENT = makeShift({ id: 'imminent', startDate: '2026-07-16T14:00:00.000Z' });
// Days away: nothing about it can change within a minute.
const LATER = makeShift({ id: 'later', startDate: '2026-07-20T09:00:00.000Z' });

// The list reads the bottom inset to keep the last card clear of the Android nav
// bar, and `useSafeAreaInsets` throws outside a provider. `initialMetrics` is not
// optional here: without it the provider waits on a native measurement that never
// arrives under jest and renders nothing at all. Values stand in for a gesture-bar
// phone; nothing here asserts on them.
const TEST_METRICS: Metrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};

function withSafeArea(node: React.ReactElement) {
  return render(<SafeAreaProvider initialMetrics={TEST_METRICS}>{node}</SafeAreaProvider>);
}

function renderList() {
  return withSafeArea(
    <ShiftList shifts={[IMMINENT, LATER]} refreshing={false} onRefresh={jest.fn()} />,
  );
}

beforeEach(() => {
  mockRenderCounts.clear();
  resetServerClock();
  jest.useFakeTimers().setSystemTime(NOW);
});

afterEach(() => {
  jest.useRealTimers();
});

describe('ShiftList', () => {
  it('renders every shift', async () => {
    await renderList();

    expect(screen.getByTestId('card-imminent')).toBeTruthy();
    expect(screen.getByTestId('card-later')).toBeTruthy();
  });

  /**
   * The guard behind the adaptive-tick design.
   *
   * The countdown has to move every second, but re-rendering the whole list at 1Hz
   * for a screen an employee leaves open all shift is a real battery cost. Only the
   * active card gets the live clock; the rest get a minute-resolution one that
   * `memo` can hold still.
   *
   * This regresses the instant someone passes `now` straight down to every card,
   * and nothing about it is visible on screen - hence the assertion.
   */
  it('does not re-render distant shifts while the countdown ticks', async () => {
    await renderList();

    const before = mockRenderCounts.get('later');

    await act(async () => {
      jest.advanceTimersByTime(10_000);
    });

    expect(mockRenderCounts.get('imminent')).toBeGreaterThan(before!);
    expect(mockRenderCounts.get('later')).toBe(before);
  });

  it('still refreshes distant shifts once the minute rolls over', async () => {
    // They must not be frozen - "Tomorrow" has to become "Today" eventually. A
    // minute is the coarsest tick that is still correct.
    await renderList();

    const before = mockRenderCounts.get('later')!;

    await act(async () => {
      jest.advanceTimersByTime(61_000);
    });

    expect(mockRenderCounts.get('later')).toBeGreaterThan(before);
  });

  it('shows an empty state rather than a blank screen', async () => {
    await withSafeArea(<ShiftList shifts={[]} refreshing={false} onRefresh={jest.fn()} />);

    expect(screen.getByText('No shifts scheduled')).toBeTruthy();
  });
});
