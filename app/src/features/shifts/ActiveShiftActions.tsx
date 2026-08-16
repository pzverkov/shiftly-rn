import { StyleSheet, View } from 'react-native';
import Animated, { FadeIn, FadeOut, LinearTransition } from 'react-native-reanimated';

import { useEndBreak, useFinishShift, useStartBreak } from '../../api/queries';
import {
  breakEligibility,
  canFinishShift,
  getActiveBreak,
  MAX_BREAKS_PER_SHIFT,
  MIN_MINUTES_BEFORE_BREAK,
  MIN_MINUTES_BREAK_DURATION,
  type Break,
} from '../../domain/breaks';
import type { Shift } from '../../domain/shift';
import { t } from '../../i18n';
import { MINUTE } from '../../time/constants';
import { serverNow } from '../../time/serverClock';
import { useNow } from '../../time/useNow';
import { Button } from '../../ui/Button';
import { Text } from '../../ui/Text';
import { colors, radius, spacing } from '../../ui/theme';
import { formatTime } from './format';
import { useBreakAction, useLocatedClockAction, type ClockAction } from './useClockAction';

type Props = {
  shift: Shift;
  breaks: Break[];
};

/**
 * The actions on a live shift: clock out, and go on / end a break.
 *
 * The break gates are time-based (2 minutes after the shift starts, 2 minutes
 * minimum duration), so this runs its own ticking clock towards the next boundary.
 * Otherwise "Go on break" and "End break" would sit disabled past the boundary
 * until something else forced a re-render.
 */
export function ActiveShiftActions({ shift, breaks }: Props) {
  // Target the next gate so the clock ticks per-second as it approaches, then goes
  // quiet. Computed from the corrected clock every render, so a boundary that only
  // becomes imminent later still engages the fast tick.
  const now = useNow(nextBreakBoundary(shift, breaks, serverNow()));

  const activeBreak = getActiveBreak(breaks);
  const eligibility = breakEligibility(shift, breaks, now);
  const canFinish = canFinishShift(shift, now);

  const finish = useFinishShift();
  const startBreak = useStartBreak();
  const endBreak = useEndBreak();

  const clockOut = useLocatedClockAction({
    shift,
    mutation: finish,
    successAnnouncement: t('a11y.clockedOut'),
  });
  const goOnBreak = useBreakAction({
    shiftId: shift.id,
    mutation: startBreak,
    successAnnouncement: t('a11y.wentOnBreak'),
  });
  const endTheBreak = useBreakAction({
    shiftId: shift.id,
    mutation: endBreak,
    successAnnouncement: t('a11y.endedBreak'),
  });

  // One write at a time: while any action is in flight or queued offline, every
  // button is disabled. The shared mutation scope already serialises them on the
  // wire; this stops the UI from even offering a second, conflicting tap.
  const anyBusy = [clockOut, goOnBreak, endTheBreak].some((a) => a.busy || a.isPaused);

  return (
    <Animated.View layout={LinearTransition} style={styles.container}>
      <Button
        testID="clock-out-button"
        label={clockOutLabel(clockOut)}
        onPress={clockOut.onPress}
        disabled={!canFinish || anyBusy}
        loading={clockOut.busy}
      />

      {activeBreak ? (
        <View style={styles.breakSection}>
          <View style={styles.onBreakBadge}>
            <Text variant="caption" tone="accent">
              {t('break.onBreakSince', { time: formatTime(activeBreak.startedAt) })}
            </Text>
          </View>
          <Button
            testID="end-break-button"
            label={endBreakLabel(endTheBreak)}
            onPress={endTheBreak.onPress}
            disabled={!eligibility.canEnd || anyBusy}
            loading={endTheBreak.busy}
            variant="secondary"
            accessibilityHint={eligibility.canEnd ? undefined : t('break.endHint')}
          />
        </View>
      ) : (
        <View style={styles.breakSection}>
          <Button
            testID="start-break-button"
            label={startBreakLabel(goOnBreak)}
            onPress={goOnBreak.onPress}
            disabled={!eligibility.canStart || anyBusy}
            loading={goOnBreak.busy}
            variant="secondary"
            accessibilityHint={blockedReason(eligibility.startBlockedReason) ?? undefined}
          />
          <Text variant="caption" tone="muted">
            {eligibility.canStart
              ? t('break.countOf', { current: breaks.length + 1, max: MAX_BREAKS_PER_SHIFT })
              : (blockedReason(eligibility.startBlockedReason) ?? '')}
          </Text>
        </View>
      )}

      {(clockOut.isPaused || goOnBreak.isPaused || endTheBreak.isPaused) && (
        <Animated.View entering={FadeIn} exiting={FadeOut} style={styles.notice}>
          <Text variant="caption" tone="pending">
            {t('break.savedOffline')}
          </Text>
        </Animated.View>
      )}

      {[clockOut, goOnBreak, endTheBreak].map((action, index) =>
        action.advice && !action.isPaused ? (
          <Animated.View key={index} entering={FadeIn} exiting={FadeOut} style={styles.error}>
            <Text variant="label" tone="danger">
              {action.advice.title}
            </Text>
            <Text variant="caption" tone="muted">
              {action.advice.detail}
            </Text>
          </Animated.View>
        ) : null,
      )}
    </Animated.View>
  );
}

/** When the next break gate opens, or null if none is imminent. Drives the tick. */
function nextBreakBoundary(shift: Shift, breaks: Break[], now: number): number | null {
  const active = getActiveBreak(breaks);
  if (active) {
    const canEndAt = new Date(active.startedAt).getTime() + MIN_MINUTES_BREAK_DURATION * MINUTE;
    return now < canEndAt ? canEndAt : null;
  }
  if (!shift.startedAt || breaks.length >= MAX_BREAKS_PER_SHIFT) return null;
  const canStartAt = new Date(shift.startedAt).getTime() + MIN_MINUTES_BEFORE_BREAK * MINUTE;
  return now < canStartAt ? canStartAt : null;
}

function blockedReason(reason: 'too-soon' | 'limit-reached' | undefined): string | null {
  if (reason === 'too-soon') return t('break.blockedTooSoon');
  if (reason === 'limit-reached') return t('break.blockedLimit');
  return null;
}

function clockOutLabel(action: ClockAction): string {
  if (action.isPaused) return t('clockOut.waitingSignal');
  if (action.acquiringLocation) return t('clockOut.checkingLocation');
  if (action.busy) return t('clockOut.clocking');
  return t('clockOut.button');
}

function startBreakLabel(action: ClockAction): string {
  if (action.isPaused) return t('break.waitingSignal');
  if (action.busy) return t('break.starting');
  return t('break.start');
}

function endBreakLabel(action: ClockAction): string {
  if (action.isPaused) return t('break.waitingSignal');
  if (action.busy) return t('break.ending');
  return t('break.end');
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.md,
  },
  breakSection: {
    gap: spacing.xs,
  },
  onBreakBadge: {
    alignSelf: 'flex-start',
    backgroundColor: colors.accentSoft,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
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
