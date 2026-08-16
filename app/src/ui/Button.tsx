import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { Text } from './Text';
import { MIN_TOUCH_TARGET, colors, radius, spacing } from './theme';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

/**
 * Press feedback. The asymmetry is deliberate: the press has to register faster
 * than the eye to feel like the button reacted, while the release settles slowly
 * enough to read as a spring rather than a snap back.
 */
const PRESS_IN_MS = 90;
const PRESS_OUT_MS = 140;

/** Kept small on purpose - enough to feel under a thumb, not enough to shift layout. */
const PRESS_SCALE = 0.02;
const PRESS_DIM = 0.08;

export type ButtonProps = {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
  variant?: 'primary' | 'secondary';
  /** Spoken instead of the label. Use when the label alone lacks context. */
  accessibilityLabel?: string;
  /** Explains *why* the button is disabled, which the label rarely can. */
  accessibilityHint?: string;
  testID?: string;
};

export function Button({
  label,
  onPress,
  disabled = false,
  loading = false,
  variant = 'primary',
  accessibilityLabel,
  accessibilityHint,
  testID,
}: ButtonProps) {
  const pressed = useSharedValue(0);
  const reducedMotion = useReducedMotion();

  const isInert = disabled || loading;

  const animatedStyle = useAnimatedStyle(() => {
    // Honour the OS setting rather than animating regardless - motion sensitivity
    // is a real accessibility need, not a preference to override.
    const scale = reducedMotion ? 1 : 1 - pressed.value * PRESS_SCALE;
    return { transform: [{ scale }], opacity: 1 - pressed.value * PRESS_DIM };
  });

  const isPrimary = variant === 'primary';
  const background = isInert
    ? colors.disabled
    : isPrimary
      ? colors.accent
      : colors.surface;

  return (
    <AnimatedPressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: isInert, busy: loading }}
      disabled={isInert}
      onPress={onPress}
      onPressIn={() => {
        pressed.value = withTiming(1, { duration: PRESS_IN_MS });
      }}
      onPressOut={() => {
        pressed.value = withTiming(0, { duration: PRESS_OUT_MS });
      }}
      style={[
        styles.base,
        { backgroundColor: background },
        !isPrimary && !isInert && styles.secondaryBorder,
        animatedStyle,
      ]}
    >
      {loading ? (
        <View style={styles.loadingRow}>
          <ActivityIndicator color={colors.disabledInk} size="small" />
          <Text variant="label" tone="faint">
            {label}
          </Text>
        </View>
      ) : (
        <Text
          variant="label"
          tone={isInert ? 'faint' : isPrimary ? 'inverse' : 'default'}
        >
          {label}
        </Text>
      )}
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: MIN_TOUCH_TARGET,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
  },
  secondaryBorder: {
    borderWidth: 1,
    borderColor: colors.line,
  },
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
});
