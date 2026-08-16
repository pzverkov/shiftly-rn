import { useEffect } from 'react';
import { type DimensionValue, type ViewStyle } from 'react-native';
import Animated, {
  cancelAnimation,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import { colors, radius } from './theme';

/** One breath in, one out. Slow enough to read as waiting, not as a spinner. */
const PULSE_DURATION_MS = 800;

/**
 * The dim end of the pulse, and the static tint under reduce-motion. The two have
 * to be the same value or turning motion off changes how loaded the block looks.
 */
const PULSE_MIN_OPACITY = 0.5;

/**
 * A placeholder block that softly pulses while real content loads. Reduce-motion
 * turns the pulse off and holds a static tint - the same accessibility respect the
 * Button makes. Marked hidden from the screen reader; the containing list carries
 * the single "loading" announcement instead of every block chattering.
 */
type Props = {
  width?: DimensionValue;
  height?: number;
  cornerRadius?: number;
  style?: ViewStyle;
};

export function Skeleton({ width = '100%', height = 12, cornerRadius = radius.sm, style }: Props) {
  const reducedMotion = useReducedMotion();
  const pulse = useSharedValue(PULSE_MIN_OPACITY);

  useEffect(() => {
    if (reducedMotion) return;
    pulse.value = withRepeat(withTiming(1, { duration: PULSE_DURATION_MS }), -1, true);
    return () => cancelAnimation(pulse);
  }, [reducedMotion, pulse]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: reducedMotion ? PULSE_MIN_OPACITY : pulse.value,
  }));

  return (
    <Animated.View
      importantForAccessibility="no-hide-descendants"
      accessibilityElementsHidden
      style={[{ width, height, borderRadius: cornerRadius, backgroundColor: colors.line }, animatedStyle, style]}
    />
  );
}
