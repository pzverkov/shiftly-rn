import { useMemo } from 'react';
import { FlatList, RefreshControl, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { findActiveShift, getShiftState, sortByStart, type Shift } from '../../domain/shift';
import { t } from '../../i18n';
import { serverNow } from '../../time/serverClock';
import { useNow } from '../../time/useNow';
import { StateMark } from '../../ui/StateMark';
import { Text } from '../../ui/Text';
import { colors, spacing } from '../../ui/theme';
import { MINUTE } from '../../time/constants';
import { ShiftCard } from './ShiftCard';

// Module scope so its identity is stable: an inline arrow here is a new component
// type every render, which unmounts and remounts every separator on every tick.
function Separator() {
  return <View style={styles.separator} />;
}

/** When the active shift's clock-in window opens, or null if nothing is imminent. */
export function nextWindowTarget(shifts: Shift[], now: number): number | null {
  const active = findActiveShift(shifts, now);
  if (!active) return null;
  const state = getShiftState(active, now);
  return state.kind === 'upcoming' ? now + state.msUntilWindow : null;
}

type Props = {
  shifts: Shift[];
  refreshing: boolean;
  onRefresh: () => void;
  ListHeaderComponent?: React.ReactElement | null;
};

export function ShiftList({ shifts, refreshing, onRefresh, ListHeaderComponent }: Props) {
  const sorted = useMemo(() => sortByStart(shifts), [shifts]);

  // Android is edge-to-edge and not opt-out from SDK 54, so the gesture bar or the
  // three-button nav sits over the bottom of the window. Padding the scroll content
  // rather than insetting the Screen keeps cards scrolling *under* the bar - which is
  // the point of edge-to-edge - while still letting the last one come to rest above it.
  const insets = useSafeAreaInsets();

  // The tick target the countdown is racing towards - the moment the active
  // shift's window opens, or null when nothing is imminent. Recomputed every
  // render from the corrected clock (never Date.now(), never a memo frozen on
  // [sorted]), so the per-second tick engages the instant a shift becomes
  // imminent - including one that only turns upcoming long after mount.
  const target = nextWindowTarget(sorted, serverNow());

  const now = useNow(target);
  const active = useMemo(() => findActiveShift(sorted, now), [sorted, now]);

  /**
   * Inactive cards only use `now` to say "Today" or "Finished", which cannot
   * change within a minute. Giving them a minute-resolution clock lets `memo` hold
   * them still while the active card ticks every second.
   */
  const coarseNow = Math.floor(now / MINUTE) * MINUTE;

  return (
    <FlatList
      data={sorted}
      keyExtractor={(shift) => shift.id}
      contentContainerStyle={[styles.content, { paddingBottom: spacing.xxl + insets.bottom }]}
      ListHeaderComponent={ListHeaderComponent}
      ItemSeparatorComponent={Separator}
      renderItem={({ item }) => {
        const isActive = item.id === active?.id;
        return <ShiftCard shift={item} isActive={isActive} now={isActive ? now : coarseNow} />;
      }}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.inkFaint} />
      }
      ListEmptyComponent={
        <View style={styles.empty}>
          <StateMark variant="empty" />
          <Text variant="title" tone="muted">
            {t('list.emptyTitle')}
          </Text>
          <Text variant="body" tone="faint" style={styles.emptyDetail}>
            {t('list.emptyDetail')}
          </Text>
        </View>
      }
    />
  );
}

const styles = StyleSheet.create({
  content: {
    padding: spacing.lg,
    flexGrow: 1,
  },
  separator: {
    height: spacing.md,
  },
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    padding: spacing.xl,
  },
  emptyDetail: {
    textAlign: 'center',
  },
});
