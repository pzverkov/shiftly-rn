import * as Localization from 'expo-localization';
import { I18n } from 'i18n-js';

import { en, he, type Translation } from './translations';

/**
 * A small i18n layer over i18n-js.
 *
 * Two separate concerns: the **language** picks the translation dictionary, the
 * **region** picks formatting - clock (12h vs 24h) and units (imperial vs metric).
 * They are split because en-US and en-GB share one dictionary (the copy is
 * region-neutral) but format differently: a US device reads "2:16 PM" and feet, a
 * UK one "14:16" and metres.
 *
 * The active profile follows the device and is resolved once at import. There is no
 * in-app switch - right-to-left is driven entirely by the OS, which lays a Hebrew
 * device out RTL at native launch.
 *
 * What this adds over bare i18n-js: translation keys are typed as dot-paths off the
 * English shape, so a typo is a compile error rather than a silent missing string.
 */

export type Language = 'en' | 'he';
export type UnitSystem = 'metric' | 'imperial';

export type LocaleProfile = {
  /** Which dictionary to read. */
  language: Language;
  /** Full BCP-47 tag for Intl formatting and `accessibilityLanguage`. */
  bcp47: string;
  /** 12-hour clock with AM/PM (US), else 24-hour. */
  hour12: boolean;
  units: UnitSystem;
};

export const localeProfiles = {
  'en-US': { language: 'en', bcp47: 'en-US', hour12: true, units: 'imperial' },
  'en-GB': { language: 'en', bcp47: 'en-GB', hour12: false, units: 'metric' },
  'he-IL': { language: 'he', bcp47: 'he-IL', hour12: false, units: 'metric' },
} as const satisfies Record<string, LocaleProfile>;

const RTL_LANGUAGES: ReadonlySet<Language> = new Set(['he']);

export function isRtlLocale(language: Language): boolean {
  return RTL_LANGUAGES.has(language);
}

// Dot-path keys derived from the English translation ('badge.ready', 'advice.tooFarTitle').
type DotPaths<T> = {
  [K in keyof T & string]: T[K] extends string ? K : `${K}.${DotPaths<T[K]>}`;
}[keyof T & string];
export type TranslationKey = DotPaths<Translation>;

/**
 * Resolve the device locale to a formatting profile. Language picks the dictionary;
 * region picks the clock and units. Only en-US is special-cased - every other
 * English region (or an English device with no region) falls back to en-GB, and any
 * unsupported language falls back to English (see decision 23).
 */
function resolveProfile(): LocaleProfile {
  try {
    const device = Localization.getLocales()[0];
    if (device?.languageCode === 'he') return localeProfiles['he-IL'];
    if (device?.languageCode === 'en' && device?.regionCode === 'US') return localeProfiles['en-US'];
    return localeProfiles['en-GB'];
  } catch {
    // getLocales can be unavailable off-device (e.g. the test runner).
    return localeProfiles['en-GB'];
  }
}

const i18n = new I18n({ en, he });
i18n.enableFallback = true;
i18n.defaultLocale = 'en';

let activeProfile: LocaleProfile = resolveProfile();
i18n.locale = activeProfile.language;

export function t(key: TranslationKey, options?: Record<string, string | number>): string {
  return i18n.t(key, options);
}

export function getLocaleProfile(): LocaleProfile {
  return activeProfile;
}

/** BCP-47 tag for the active locale, e.g. for `accessibilityLanguage`. */
export function localeTag(): string {
  return activeProfile.bcp47;
}

/** Test seam: force a profile. Pair with `resetLocale()` in teardown. */
export function setActiveLocale(profile: LocaleProfile): void {
  activeProfile = profile;
  i18n.locale = profile.language;
}

/** Test seam: re-resolve from the (mocked) device. */
export function resetLocale(): void {
  activeProfile = resolveProfile();
  i18n.locale = activeProfile.language;
}
