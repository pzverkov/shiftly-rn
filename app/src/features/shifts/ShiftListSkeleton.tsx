import { StyleSheet, View } from 'react-native';

import { t } from '../../i18n';
import { Card } from '../../ui/Card';
import { Skeleton } from '../../ui/Skeleton';
import { spacing } from '../../ui/theme';

/**
 * The cold-start loading state: placeholder cards shaped like the real ones, so the
 * screen shows its structure immediately instead of a lone spinner. Only the first
 * load uses this; a refresh with cached shifts keeps the list and pulls to refresh.
 */
function ShiftCardSkeleton() {
  return (
    <Card testID="shift-card-skeleton">
      <View style={styles.header}>
        <View style={styles.headerText}>
          <Skeleton width={150} height={20} />
          <Skeleton width={90} height={14} />
        </View>
        <Skeleton width={68} height={22} cornerRadius={999} />
      </View>
      <View style={styles.when}>
        <Skeleton width={56} height={14} />
        <Skeleton width={128} height={18} />
      </View>
    </Card>
  );
}

export function ShiftListSkeleton({ count = 3 }: { count?: number }) {
  return (
    <View
      style={styles.list}
      accessibilityRole="progressbar"
      accessibilityLabel={t('a11y.loadingShifts')}
    >
      {Array.from({ length: count }, (_, index) => (
        <ShiftCardSkeleton key={index} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  list: {
    padding: spacing.lg,
    gap: spacing.md,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: spacing.md,
  },
  headerText: {
    flex: 1,
    gap: spacing.sm,
  },
  when: {
    gap: spacing.sm,
  },
});
