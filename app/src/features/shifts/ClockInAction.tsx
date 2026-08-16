import { Linking, StyleSheet, View } from 'react-native';
import Animated, { FadeIn, FadeOut, LinearTransition } from 'react-native-reanimated';

import { useStartShift } from '../../api/queries';
import { SHIFT_START_WINDOW_MINUTES, type Shift, type ShiftState } from '../../domain/shift';
import { t } from '../../i18n';
import { Button } from '../../ui/Button';
import { Text } from '../../ui/Text';
import { colors, radius, spacing } from '../../ui/theme';
import { describeCountdownForA11y, formatCountdown } from './format';
import { useLocatedClockAction } from './useClockAction';

type Props = {
  shift: Shift;
  state: Extract<ShiftState, { kind: 'upcoming' } | { kind: 'clock-in-open' }>;
};

export function ClockInAction({ shift, state }: Props) {
  const startShift = useStartShift();
  const action = useLocatedClockAction({
    shift,
    mutation: startShift,
    successAnnouncement: t('a11y.clockedIn'),
  });

  const isOpen = state.kind === 'clock-in-open';

  return (
    <Animated.View layout={LinearTransition} style={styles.container}>
      {state.kind === 'upcoming' && (
        <View
          style={styles.countdown}
          accessible
          accessibilityLabel={describeCountdownForA11y(state.msUntilWindow)}
        >
          <Text variant="caption" tone="pending">
            {t('clockIn.opensIn')}
          </Text>
          <Text variant="display" tone="pending" numeric>
            {formatCountdown(state.msUntilWindow)}
          </Text>
        </View>
      )}

      <Button
        testID="clock-in-button"
        label={buttonLabel(action.busy, action.acquiringLocation, action.isPaused)}
        onPress={action.onPress}
        disabled={!isOpen}
        loading={action.busy}
        accessibilityHint={
          isOpen ? undefined : t('clockIn.disabledHint', { minutes: SHIFT_START_WINDOW_MINUTES })
        }
      />

      {action.isPaused && (
        <Animated.View entering={FadeIn} exiting={FadeOut} style={styles.notice}>
          <Text variant="caption" tone="pending">
            {t('clockIn.savedOffline')}
          </Text>
        </Animated.View>
      )}

      {action.advice && !action.isPaused && (
        <Animated.View entering={FadeIn} exiting={FadeOut} style={styles.error}>
          <Text variant="label" tone="danger">
            {action.advice.title}
          </Text>
          <Text variant="caption" tone="muted">
            {action.advice.detail}
          </Text>
          {action.advice.action === 'openSettings' && (
            <Button
              label={t('advice.openSettings')}
              onPress={() => void Linking.openSettings()}
              variant="secondary"
            />
          )}
        </Animated.View>
      )}
    </Animated.View>
  );
}

function buttonLabel(busy: boolean, acquiringLocation: boolean, isPaused: boolean): string {
  if (isPaused) return t('clockIn.waitingSignal');
  if (acquiringLocation) return t('clockIn.checkingLocation');
  if (busy) return t('clockIn.clocking');
  return t('clockIn.button');
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.md,
  },
  countdown: {
    alignItems: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.sm,
  },
  notice: {
    backgroundColor: colors.pendingSoft,
    borderRadius: radius.sm,
    padding: spacing.md,
  },
  error: {
    backgroundColor: colors.dangerSoft,
    borderRadius: radius.sm,
    padding: spacing.md,
    gap: spacing.xs,
  },
});
