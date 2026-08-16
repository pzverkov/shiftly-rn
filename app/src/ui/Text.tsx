import { Text as RNText, type TextProps as RNTextProps } from 'react-native';

import { localeTag } from '../i18n';
import { colors, tabularNums, type as typeScale } from './theme';

type Variant = keyof typeof typeScale;
type Tone = 'default' | 'muted' | 'faint' | 'accent' | 'pending' | 'danger' | 'inverse';

const tones: Record<Tone, string> = {
  default: colors.ink,
  muted: colors.inkMuted,
  faint: colors.inkFaint,
  accent: colors.accent,
  pending: colors.pending,
  danger: colors.danger,
  inverse: colors.surface,
};

/**
 * Text respects the OS font-size setting (Dynamic Type), but the largest headings
 * are capped so an accessibility text size cannot overflow a card or blow the
 * countdown off screen. Body-level text is left uncapped - it is what most needs
 * to scale, and it reflows safely.
 */
const MAX_SCALE: Partial<Record<Variant, number>> = {
  display: 1.3,
  title: 1.5,
};

export type TextProps = RNTextProps & {
  variant?: Variant;
  tone?: Tone;
  /** Tabular figures. Use for anything that ticks or aligns in a column. */
  numeric?: boolean;
};

export function Text({
  variant = 'body',
  tone = 'default',
  numeric = false,
  style,
  ...rest
}: TextProps) {
  return (
    <RNText
      // So a screen reader speaks each language in its own voice rather than
      // reading Hebrew with an English one.
      accessibilityLanguage={localeTag()}
      maxFontSizeMultiplier={MAX_SCALE[variant]}
      style={[typeScale[variant], { color: tones[tone] }, numeric && tabularNums, style]}
      {...rest}
    />
  );
}
