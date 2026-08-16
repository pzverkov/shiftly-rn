import { en, he } from './translations';
import { isRtlLocale } from './index';

/**
 * The `Translation` type already forces each locale to be structurally complete at
 * compile time. This is the runtime backstop: it catches an interpolation
 * placeholder that was translated away, and documents that the two locales are
 * meant to stay key-for-key identical.
 */

function flatten(obj: Record<string, unknown>, prefix = ''): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(obj)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (typeof value === 'string') out[path] = value;
    else Object.assign(out, flatten(value as Record<string, unknown>, path));
  }
  return out;
}

const enFlat = flatten(en);

describe('translations', () => {
  it.each([['he', he]])('%s has exactly the same keys as English', (_name, locale) => {
    expect(Object.keys(flatten(locale)).sort()).toEqual(Object.keys(enFlat).sort());
  });

  it.each([['he', he]])('%s keeps every {{placeholder}} the English string uses', (_name, locale) => {
    const localeFlat = flatten(locale);
    const placeholders = (s: string) => (s.match(/\{\{\w+\}\}/g) ?? []).sort();

    for (const [key, english] of Object.entries(enFlat)) {
      // A dropped placeholder means an interpolated value silently vanishes.
      expect(placeholders(localeFlat[key])).toEqual(placeholders(english));
    }
  });

  it('classifies reading direction correctly', () => {
    expect(isRtlLocale('en')).toBe(false);
    expect(isRtlLocale('he')).toBe(true);
  });
});
