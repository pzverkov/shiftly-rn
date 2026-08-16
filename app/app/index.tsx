import { useNetInfo } from '@react-native-community/netinfo';
import { StyleSheet, Switch, View } from 'react-native';

import { useShifts } from '../src/api/queries';
import { ShiftList } from '../src/features/shifts/ShiftList';
import { ShiftListSkeleton } from '../src/features/shifts/ShiftListSkeleton';
import { SyncStatusBanner } from '../src/features/shifts/SyncStatusBanner';
import { t } from '../src/i18n';
import { useDevLocationOverride } from '../src/location/devOverride';
import { Button } from '../src/ui/Button';
import { Screen } from '../src/ui/Screen';
import { StateMark } from '../src/ui/StateMark';
import { Text } from '../src/ui/Text';
import { colors, radius, spacing } from '../src/ui/theme';

export default function ShiftsScreen() {
  const { data: shifts, isPending, isError, refetch, isRefetching } = useShifts();
  const netInfo = useNetInfo();

  const isOffline = netInfo.isConnected === false;

  if (isPending) {
    return (
      <Screen>
        <ShiftListSkeleton />
      </Screen>
    );
  }

  /**
   * Only a true dead end reaches here. Because queries are `offlineFirst` with a
   * persisted cache, going offline with shifts already loaded keeps showing them
   * behind the banner below rather than throwing the user out to this screen.
   */
  if (isError && !shifts) {
    return (
      <Screen style={styles.centered}>
        <View style={styles.errorBox}>
          <StateMark variant={isOffline ? 'offline' : 'server'} />
          <Text variant="title">{isOffline ? t('error.offlineTitle') : t('error.serverTitle')}</Text>
          <Text variant="body" tone="muted" style={styles.errorDetail}>
            {isOffline ? t('error.offlineDetail') : t('error.serverDetail')}
          </Text>
          <Button label={t('error.tryAgain')} onPress={() => void refetch()} variant="secondary" />
        </View>
      </Screen>
    );
  }

  return (
    <Screen>
      <ShiftList
        shifts={shifts ?? []}
        refreshing={isRefetching}
        onRefresh={() => void refetch()}
        ListHeaderComponent={
          <View style={styles.header}>
            <SyncStatusBanner isOffline={isOffline} />
            <DevLocationToggle />
          </View>
        }
      />
    </Screen>
  );
}

/**
 * Dev only. The fixtures put every branch in London and the server enforces a 50m
 * geofence, so a simulator sitting in Cupertino can never clock in. Rather than
 * soften the geofence handling to make the demo work, this stands in for the GPS
 * and leaves the real path untouched.
 */
function DevLocationToggle() {
  const [enabled, setEnabled] = useDevLocationOverride();

  if (!__DEV__) return null;

  return (
    <View style={styles.devRow}>
      <View style={styles.devText}>
        <Text variant="caption" tone="muted">
          {t('dev.toggleLabel')}
        </Text>
        <Text variant="caption" tone="faint">
          {enabled ? t('dev.usingBranch') : t('dev.usingGps')}
        </Text>
      </View>
      <Switch value={enabled} onValueChange={setEnabled} accessibilityLabel={t('dev.toggleLabel')} />
    </View>
  );
}

const styles = StyleSheet.create({
  centered: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
  },
  header: {
    gap: spacing.md,
    marginBottom: spacing.md,
  },
  devRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    borderStyle: 'dashed',
    borderRadius: radius.sm,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  devText: {
    flex: 1,
    gap: 2,
  },
  errorBox: {
    gap: spacing.md,
    alignItems: 'center',
    maxWidth: 320,
  },
  errorDetail: {
    textAlign: 'center',
  },
});
