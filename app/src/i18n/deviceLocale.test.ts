/**
 * The starting profile, resolved from the device language and region.
 *
 * Language picks the dictionary; region picks the clock and units. Only en-US is
 * special-cased - every other English region (or none) is en-GB, and any
 * unsupported language falls back to English (see decision 23). The module reads
 * the device locale once at import, so each case re-imports it fresh.
 */

function loadWithDeviceLocale(languageCode?: string, regionCode?: string) {
  jest.resetModules();
  jest.doMock('expo-localization', () => ({
    getLocales: () => (languageCode ? [{ languageCode, regionCode }] : []),
  }));
  return require('./index') as typeof import('./index');
}

const tagFor = (languageCode?: string, regionCode?: string) =>
  loadWithDeviceLocale(languageCode, regionCode).getLocaleProfile().bcp47;

afterEach(() => {
  jest.dontMock('expo-localization');
  jest.resetModules();
});

describe('starting profile from the device', () => {
  it('gives a US device the US profile - 12h and imperial', () => {
    const { getLocaleProfile } = loadWithDeviceLocale('en', 'US');
    expect(getLocaleProfile()).toMatchObject({ bcp47: 'en-US', hour12: true, units: 'imperial' });
  });

  it('gives a British device the GB profile - 24h and metric', () => {
    const { getLocaleProfile } = loadWithDeviceLocale('en', 'GB');
    expect(getLocaleProfile()).toMatchObject({ bcp47: 'en-GB', hour12: false, units: 'metric' });
  });

  it('gives a Hebrew device the Hebrew profile regardless of region', () => {
    expect(tagFor('he', 'IL')).toBe('he-IL');
    expect(tagFor('he', 'US')).toBe('he-IL');
  });

  it('defaults any other English region to en-GB', () => {
    expect(tagFor('en')).toBe('en-GB');
    expect(tagFor('en', 'AU')).toBe('en-GB');
    expect(tagFor('en', 'CA')).toBe('en-GB');
  });

  it('falls back to English for a language we do not support', () => {
    expect(tagFor('ar')).toBe('en-GB');
    expect(tagFor('fr', 'FR')).toBe('en-GB');
  });

  it('falls back to English when the device reports no locale', () => {
    expect(tagFor(undefined)).toBe('en-GB');
  });
});
