import { StyleSheet, View, type ViewProps } from 'react-native';

import { colors, radius, shadow, spacing } from './theme';

export type CardProps = ViewProps & {
  /** Lifts the card for the one shift the user can actually act on. */
  emphasis?: boolean;
};

export function Card({ emphasis = false, style, ...rest }: CardProps) {
  return <View style={[styles.base, emphasis && styles.emphasis, style]} {...rest} />;
}

const styles = StyleSheet.create({
  base: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.line,
    padding: spacing.lg,
    gap: spacing.md,
  },
  emphasis: {
    borderColor: colors.accentSoft,
    ...(shadow.card ?? {}),
  },
});
