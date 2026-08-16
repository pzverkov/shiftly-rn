import { memo } from 'react';
import { StyleSheet, View } from 'react-native';

import { useBreaks } from '../../api/queries';
import { getActiveBreak, type Break } from '../../domain/breaks';
import { getShiftState, type Shift, type ShiftState } from '../../domain/shift';
import { t } from '../../i18n';
import { Card } from '../../ui/Card';
import { Text } from '../../ui/Text';
import { colors, radius, spacing } from '../../ui/theme';
import { ActiveShiftActions } from './ActiveShiftActions';
import { CardSyncChip } from './CardSyncChip';
import { ClockInAction } from './ClockInAction';
import { formatShiftDay, formatTime, formatTimeRange } from './format';

type Props = {
  shift: Shift;
  /**
   * The card the user can act on. Only this one gets a live `now`, so the ticking
   * clock cannot re-render the rest of the list. See ShiftList.
   */
  isActive: boolean;
  now: number;
};

function ShiftCardComponent({ shift, isActive, now }: Props) {
  const state = getShiftState(shift, now);
  const actionable = isActive && (state.kind === 'upcoming' || state.kind === 'clock-in-open');
  const isLive = isActive && state.kind === 'started';

  // Only the live active card fetches breaks; every other card passes enabled=false,
  // so no observer fires a request. getActiveBreak also drives the on-break badge.
  const breaks = useBreaks(shift.id, isLive).data ?? [];
  const activeBreak = getActiveBreak(breaks);

  return (
    <Card emphasis={actionable || isLive} testID={`shift-card-${shift.id}`}>
      <View style={styles.header}>
        <View style={styles.headerText}>
          <Text variant="title">{shift.brand.name}</Text>
          <Text variant="caption" tone="muted">
            {shift.branch.name}
          </Text>
        </View>
        <View style={styles.headerRight}>
          <StatusBadge state={state} activeBreak={activeBreak} />
          <CardSyncChip shiftId={shift.id} />
        </View>
      </View>

      <View style={styles.when}>
        <Text variant="label" tone="muted">
          {formatShiftDay(shift.startDate, now)}
        </Text>
        <Text variant="body" numeric>
          {formatTimeRange(shift.startDate, shift.endDate)}
        </Text>
      </View>

      {actionable && <ClockInAction shift={shift} state={state} />}
      {isLive && <ActiveShiftActions shift={shift} breaks={breaks} />}
    </Card>
  );
}

function StatusBadge({ state, activeBreak }: { state: ShiftState; activeBreak: Break | null }) {
  switch (state.kind) {
    case 'started':
      return activeBreak ? (
        <Badge tone="accent" label={t('badge.onBreak')} />
      ) : (
        <Badge tone="accent" label={t('badge.onShiftSince', { time: formatTime(state.startedAt) })} />
      );
    case 'clock-in-open':
      return <Badge tone="accent" label={t('badge.ready')} />;
    case 'finished':
      return <Badge tone="muted" label={t('badge.finished')} />;
    case 'missed':
      return <Badge tone="muted" label={t('badge.notClockedIn')} />;
    case 'upcoming':
    case 'future':
      return null;
  }
}

function Badge({ tone, label }: { tone: 'accent' | 'muted'; label: string }) {
  return (
    <View style={[styles.badge, tone === 'accent' ? styles.badgeAccent : styles.badgeMuted]}>
      <Text variant="caption" tone={tone === 'accent' ? 'accent' : 'faint'}>
        {label}
      </Text>
    </View>
  );
}

/**
 * The list re-renders every tick for the active card. Memoising means the other
 * cards, whose props are unchanged, do not re-render with it. Guarded by a test -
 * see ShiftList.test.tsx.
 */
export const ShiftCard = memo(ShiftCardComponent);

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: spacing.md,
  },
  headerText: {
    flex: 1,
    gap: 2,
  },
  headerRight: {
    alignItems: 'flex-end',
    gap: spacing.xs,
  },
  when: {
    gap: 2,
  },
  badge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radius.pill,
  },
  badgeAccent: {
    backgroundColor: colors.accentSoft,
  },
  badgeMuted: {
    backgroundColor: colors.paper,
    borderWidth: 1,
    borderColor: colors.line,
  },
});
