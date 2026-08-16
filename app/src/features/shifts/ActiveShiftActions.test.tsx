import { QueryClientProvider } from '@tanstack/react-query';
import { act, render, screen } from '@testing-library/react-native';

import { ActiveShiftActions } from './ActiveShiftActions';
import { createQueryClient } from '../../api/queries';
import type { Break } from '../../domain/breaks';
import { makeShift } from '../../domain/testFixtures';
import { resetServerClock } from '../../time/serverClock';

/**
 * The break gates are time-based, so the button has to enable itself when the
 * clock crosses the boundary - not sit disabled until some other render nudges it.
 * These drive the adaptive-tick clock with fake timers and assert exactly that.
 */

// Reanimated's worklets runtime does not exist under jest. The layout animations
// are irrelevant to this screen's logic, so stand Animated.View in with a plain View.
jest.mock('react-native-reanimated', () => {
  const { View } = require('react-native');
  return { __esModule: true, default: { View }, FadeIn: {}, FadeOut: {}, LinearTransition: {} };
});

// Button drives Reanimated, absent under jest. Stand in with a plain touchable
// that exposes its disabled state, as ErrorFallback.test does.
jest.mock('../../ui/Button', () => {
  const { Pressable, Text } = require('react-native');
  return {
    Button: ({
      label,
      onPress,
      disabled,
      testID,
    }: {
      label: string;
      onPress: () => void;
      disabled?: boolean;
      testID?: string;
    }) => (
      <Pressable testID={testID} onPress={onPress} accessibilityState={{ disabled: !!disabled }}>
        <Text>{label}</Text>
      </Pressable>
    ),
  };
});

const STARTED_AT = '2026-07-16T14:00:00.000Z';
const shift = makeShift({ startDate: STARTED_AT, startedAt: STARTED_AT });

function makeBreak(startedAt: string, endedAt: string | null = null): Break {
  return { id: `break-${startedAt}`, shiftId: shift.id, startedAt, endedAt };
}

let client: ReturnType<typeof createQueryClient>;

function renderActions(breaks: Break[]) {
  client = createQueryClient();
  return render(
    <QueryClientProvider client={client}>
      <ActiveShiftActions shift={shift} breaks={breaks} />
    </QueryClientProvider>,
  );
}

function isDisabled(testID: string): boolean {
  return screen.getByTestId(testID).props.accessibilityState.disabled;
}

afterEach(() => {
  jest.useRealTimers();
  client.getQueryCache().getAll().forEach((query) => query.destroy());
  client.getMutationCache().getAll().forEach((mutation) => mutation.destroy());
  client.clear();
});

describe('ActiveShiftActions', () => {
  it('disables "Go on break" before the two-minute gate, then enables it when the clock passes it', async () => {
    // One minute into the shift: the break gate (2 min) has not opened yet.
    resetServerClock();
    jest.useFakeTimers().setSystemTime(new Date('2026-07-16T14:01:00.000Z'));

    await renderActions([]);

    expect(isDisabled('start-break-button')).toBe(true);

    // Cross the 2-minute boundary. The ticking clock re-reads the time and the
    // button enables itself with no other interaction.
    await act(async () => {
      jest.advanceTimersByTime(120_000);
    });

    expect(isDisabled('start-break-button')).toBe(false);
  });

  it('shows End break instead of Go on break while a break is active', async () => {
    resetServerClock();
    jest.useFakeTimers().setSystemTime(new Date('2026-07-16T14:30:00.000Z'));

    // Break started five minutes ago, so it is past the 2-minute minimum duration.
    await renderActions([makeBreak('2026-07-16T14:25:00.000Z')]);

    expect(screen.getByTestId('end-break-button')).toBeTruthy();
    expect(screen.queryByTestId('start-break-button')).toBeNull();
    expect(isDisabled('end-break-button')).toBe(false);
    expect(screen.getByText('On break since 14:25')).toBeTruthy();
  });

  it('blocks a third break with a reason once both are used', async () => {
    resetServerClock();
    jest.useFakeTimers().setSystemTime(new Date('2026-07-16T16:00:00.000Z'));

    await renderActions([
      makeBreak('2026-07-16T14:10:00.000Z', '2026-07-16T14:20:00.000Z'),
      makeBreak('2026-07-16T15:10:00.000Z', '2026-07-16T15:20:00.000Z'),
    ]);

    expect(isDisabled('start-break-button')).toBe(true);
    expect(screen.getByText("You've used both breaks")).toBeTruthy();
  });
});
