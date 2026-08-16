import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';

import { useQueueSummary, useSyncedPulse } from '../../api/syncStatus';
import { announce } from '../../a11y/announce';
import { t } from '../../i18n';
import { Text } from '../../ui/Text';
import { colors, radius, spacing } from '../../ui/theme';

/**
 * One line at the top of the list that always answers "is my last tap safe?".
 *
 * It moves through the whole offline lifecycle in one place so the states never
 * contradict each other: offline-with-queue -> back-online-syncing -> synced. Each
 * state carries the count, so the worker sees exactly how many actions are still in
 * flight, and the "synced" line is a self-clearing pulse rather than a sticky badge
 * that would linger with nothing left to say.
 *
 * The per-card chip (see ShiftCard) narrates the same lifecycle at the row level;
 * this is the roll-up across every card.
 */
export function SyncStatusBanner({ isOffline }: { isOffline: boolean }) {
  const { queued, syncing } = useQueueSummary();
  // Gated on a successful drain across every card's writes, not merely on syncing
  // reaching zero - which also happens on a rejection or a re-pause.
  const justSynced = useSyncedPulse();

  if (syncing > 0) {
    return (
      <Banner tone="accent">
        {syncing === 1 ? t('sync.syncingOne') : t('sync.syncingMany', { count: syncing })}
      </Banner>
    );
  }

  if (justSynced) {
    return <SyncedBanner />;
  }

  if (isOffline && queued > 0) {
    return (
      <Banner tone="pending">
        {queued === 1 ? t('sync.offlineWaitingOne') : t('sync.offlineWaitingMany', { count: queued })}
      </Banner>
    );
  }

  if (isOffline) {
    return (
      <Banner tone="pending" assertive>
        {t('offline.banner')}
      </Banner>
    );
  }

  return null;
}

/** The synced pulse also announces itself once, since it clears before a reader may reach it. */
function SyncedBanner() {
  useEffect(() => {
    announce(t('sync.a11ySynced'));
  }, []);

  return (
    <Banner tone="accent">{t('sync.syncedAll')}</Banner>
  );
}

function Banner({
  tone,
  assertive = false,
  children,
}: {
  tone: 'pending' | 'accent';
  /** The bare offline notice interrupts (alert); reconnect updates are polite. */
  assertive?: boolean;
  children: string;
}) {
  return (
    <Animated.View
      entering={FadeIn}
      exiting={FadeOut}
      accessibilityRole={assertive ? 'alert' : undefined}
      accessibilityLiveRegion={assertive ? 'assertive' : 'polite'}
      style={[styles.banner, tone === 'accent' ? styles.bannerAccent : styles.bannerPending]}
    >
      <View style={[styles.dot, tone === 'accent' ? styles.dotAccent : styles.dotPending]} />
      <Text variant="caption" tone={tone}>
        {children}
      </Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderRadius: radius.sm,
    padding: spacing.md,
  },
  bannerPending: {
    backgroundColor: colors.pendingSoft,
  },
  bannerAccent: {
    backgroundColor: colors.accentSoft,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: radius.pill,
  },
  dotPending: {
    backgroundColor: colors.pending,
  },
  dotAccent: {
    backgroundColor: colors.accent,
  },
});
