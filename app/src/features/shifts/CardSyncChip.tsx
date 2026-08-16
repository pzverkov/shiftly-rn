import { StyleSheet, View } from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';

import { useCardSyncState, useSyncedPulse } from '../../api/syncStatus';
import { t } from '../../i18n';
import { Text } from '../../ui/Text';
import { colors, radius, spacing } from '../../ui/theme';

/**
 * A row-level echo of the sync lifecycle for one shift's writes.
 *
 * It narrates only the reconnect half - "Syncing" while a write is on the wire, then
 * a self-clearing "Synced" once the card's queue drains. The queued half is left to
 * the action's own "saved offline" notice and the button label, so a single card
 * never says the same thing twice; this chip is what fills the gap between "saved"
 * and "done" that was previously invisible.
 */
export function CardSyncChip({ shiftId }: { shiftId: string }) {
  const state = useCardSyncState(shiftId);
  // Fires only when this shift's queue drains by succeeding, so a rejected write
  // does not flash "Synced" next to its own error.
  const justSynced = useSyncedPulse(shiftId);

  if (state === 'syncing') {
    return (
      <Chip>
        <View style={styles.dot} />
        <Text variant="caption" tone="accent">
          {t('sync.chipSyncing')}
        </Text>
      </Chip>
    );
  }

  if (justSynced) {
    return (
      <Chip>
        <Text variant="caption" tone="accent">
          {'✓ '}
          {t('sync.chipSynced')}
        </Text>
      </Chip>
    );
  }

  return null;
}

function Chip({ children }: { children: React.ReactNode }) {
  return (
    <Animated.View entering={FadeIn} exiting={FadeOut} style={styles.chip}>
      {children}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: colors.accentSoft,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: radius.pill,
    backgroundColor: colors.accent,
  },
});
