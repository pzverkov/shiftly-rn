import { Platform, type TextStyle } from 'react-native';

/**
 * Design tokens.
 *
 * The context this gets used in drove most of these choices: a phone pulled out
 * for ten seconds at the start of a shift, in a kitchen, often one-handed and in
 * bad light. That argues for warm neutrals over stark white, high contrast ink,
 * one accent used only where an action is genuinely available, and touch targets
 * that survive a rushed thumb.
 */

export const colors = {
  /** Warm off-white. Pure #fff reads clinical and glares under kitchen lighting. */
  paper: '#FBF9F7',
  surface: '#FFFFFF',
  ink: '#16130F',
  inkMuted: '#6B635A',
  inkFaint: '#9C948A',
  line: '#E8E2DB',

  /** Reserved for "you can act now". Used sparingly so it keeps meaning. */
  accent: '#0F6B4F',
  accentPressed: '#0A5540',
  accentSoft: '#E6F2EC',

  /** Waiting, counting down, queued. */
  pending: '#8A6A17',
  pendingSoft: '#FBF2DD',

  danger: '#9B2C2C',
  dangerSoft: '#FBECEC',

  disabled: '#E2DCD4',
  disabledInk: '#A29A90',
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
} as const;

export const radius = {
  sm: 8,
  md: 12,
  lg: 18,
  pill: 999,
} as const;

/** Minimum comfortable target. Below 44 is a miss with a thumb in a hurry. */
export const MIN_TOUCH_TARGET = 48;

// Weights are the RN-valid hundreds only. '650' is not a member of the fontWeight
// union - iOS silently falls back to regular for an unknown key, so titles would
// have rendered un-bold on device while tsc stayed quiet behind a cast.
export const type = {
  display: { fontSize: 40, lineHeight: 44, fontWeight: '700' },
  title: { fontSize: 20, lineHeight: 26, fontWeight: '600' },
  body: { fontSize: 16, lineHeight: 22, fontWeight: '400' },
  label: { fontSize: 14, lineHeight: 19, fontWeight: '600' },
  caption: { fontSize: 13, lineHeight: 17, fontWeight: '500' },
} as const satisfies Record<string, TextStyle>;

/**
 * Proportional digits change width as they tick, so a running countdown visibly
 * jitters. Tabular figures are the fix and cost nothing.
 */
export const tabularNums = { fontVariant: ['tabular-nums' as const] };

export const shadow = {
  card: Platform.select({
    ios: {
      shadowColor: '#2B2118',
      shadowOpacity: 0.06,
      shadowRadius: 12,
      shadowOffset: { width: 0, height: 4 },
    },
    android: { elevation: 2 },
    default: {},
  }),
} as const;
