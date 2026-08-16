import { StyleSheet, View } from 'react-native';

import { colors, radius } from './theme';

/**
 * A small geometric mark for the list-level states, built from plain Views so it
 * needs no icon library and stays on-brand with the restrained UI. Purely
 * decorative - hidden from the screen reader, which reads the copy beside it.
 *
 * The motif is a stylised shift card (a rounded rectangle with two text bars); the
 * error variants overlay a signal cue on it. Each variant carries its state's tone.
 */
export type StateMarkVariant = 'empty' | 'offline' | 'server';

const TONES: Record<StateMarkVariant, { soft: string; ink: string }> = {
  empty: { soft: colors.accentSoft, ink: colors.accent },
  offline: { soft: colors.pendingSoft, ink: colors.pending },
  server: { soft: colors.dangerSoft, ink: colors.danger },
};

export function StateMark({ variant }: { variant: StateMarkVariant }) {
  const { soft, ink } = TONES[variant];

  return (
    <View
      importantForAccessibility="no-hide-descendants"
      accessibilityElementsHidden
      style={[styles.badge, { backgroundColor: soft }]}
    >
      <View style={[styles.card, { borderColor: ink }]}>
        <View style={[styles.bar, { backgroundColor: ink, width: 20 }]} />
        <View style={[styles.bar, { backgroundColor: ink, width: 12, opacity: 0.5 }]} />
      </View>

      {variant === 'offline' && <View style={[styles.slash, { backgroundColor: ink }]} />}
      {variant === 'server' && (
        <View style={styles.alert}>
          <View style={[styles.alertBar, { backgroundColor: ink }]} />
          <View style={[styles.alertDot, { backgroundColor: ink }]} />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    width: 72,
    height: 72,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  card: {
    width: 38,
    height: 32,
    borderRadius: radius.sm,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  bar: {
    height: 3,
    borderRadius: radius.pill,
  },
  // A single diagonal stroke across the card, reading as "no connection".
  slash: {
    position: 'absolute',
    width: 52,
    height: 3,
    borderRadius: radius.pill,
    transform: [{ rotate: '-45deg' }],
  },
  // A compact exclamation, reading as "something is wrong on the server".
  alert: {
    position: 'absolute',
    right: 12,
    bottom: 12,
    alignItems: 'center',
    gap: 2,
  },
  alertBar: {
    width: 3,
    height: 9,
    borderRadius: radius.pill,
  },
  alertDot: {
    width: 3,
    height: 3,
    borderRadius: radius.pill,
  },
});
