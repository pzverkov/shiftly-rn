import { render, screen } from '@testing-library/react-native';

import { ShiftListSkeleton } from './ShiftListSkeleton';

// Reanimated's worklet runtime is absent under jest, and the pulse is irrelevant to
// what this asserts. Force reduce-motion so the Skeleton takes its static branch and
// arms no animation, and stand Animated.View in with a plain View.
jest.mock('react-native-reanimated', () => {
  const { View } = require('react-native');
  return {
    __esModule: true,
    default: { View },
    useReducedMotion: () => true,
    useSharedValue: (value: number) => ({ value }),
    useAnimatedStyle: () => ({}),
    withRepeat: (value: unknown) => value,
    withTiming: (value: unknown) => value,
    cancelAnimation: () => {},
  };
});

describe('ShiftListSkeleton', () => {
  it('shows three placeholder cards by default', async () => {
    await render(<ShiftListSkeleton />);
    expect(screen.getAllByTestId('shift-card-skeleton')).toHaveLength(3);
  });

  it('honours a custom count', async () => {
    await render(<ShiftListSkeleton count={5} />);
    expect(screen.getAllByTestId('shift-card-skeleton')).toHaveLength(5);
  });

  it('announces itself as loading to a screen reader', async () => {
    await render(<ShiftListSkeleton />);
    // One labelled progress region carries the announcement, not each block.
    expect(screen.getByLabelText('Loading your shifts')).toBeTruthy();
  });
});
