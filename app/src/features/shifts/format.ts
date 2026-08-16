import { getLocaleProfile, t, type LocaleProfile } from '../../i18n';
import { HOUR, MINUTE } from '../../time/constants';

/**
 * Display formatting for shifts.
 *
 * Time format follows the region: en-US reads a 12-hour clock ("2:16 PM"), every
 * other locale a 24-hour one ("14:16") - how a rota is read outside the US, and it
 * sidesteps AM/PM translation there. The Intl locale is the profile's BCP-47 tag,
 * so day/month order and Hebrew's calendar and digit shaping come for free.
 */

const FEET_PER_METER = 3.28084;

// Intl formatters are relatively costly to construct, so cache one set per locale tag.
const cache = new Map<string, { time: Intl.DateTimeFormat; weekday: Intl.DateTimeFormat }>();

function formatters(profile: LocaleProfile) {
  let cached = cache.get(profile.bcp47);
  if (!cached) {
    cached = {
      // 'numeric' in 12h drops the leading zero ("2:16 PM", not "02:16 PM"); 24h
      // keeps '2-digit' for a stable "14:16".
      time: new Intl.DateTimeFormat(profile.bcp47, {
        hour: profile.hour12 ? 'numeric' : '2-digit',
        minute: '2-digit',
        hour12: profile.hour12,
      }),
      weekday: new Intl.DateTimeFormat(profile.bcp47, { weekday: 'short', day: 'numeric', month: 'short' }),
    };
    cache.set(profile.bcp47, cached);
  }
  return cached;
}

export function formatTimeRange(startIso: string, endIso: string): string {
  const { time } = formatters(getLocaleProfile());
  return `${time.format(new Date(startIso))} - ${time.format(new Date(endIso))}`;
}

export function formatTime(iso: string): string {
  return formatters(getLocaleProfile()).time.format(new Date(iso));
}

/**
 * A distance for display, in the active region's units. Metric locales get metres;
 * en-US gets feet, rounded to the nearest 5 so the geofence reads as "165 ft" not
 * "164 ft". The unit word lives in the translations (`units.*`) rather than relying
 * on Intl's unit formatting, which is unreliable on Hermes/Android. Server-side the
 * geofence stays metric regardless - this only changes what the user reads.
 */
export function formatDistance(meters: number): string {
  const profile = getLocaleProfile();
  if (profile.units === 'imperial') {
    const feet = Math.round((meters * FEET_PER_METER) / 5) * 5;
    return t('units.feet', { value: feet });
  }
  return t('units.meters', { value: Math.round(meters) });
}

function isSameLocalDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

export function formatShiftDay(startIso: string, now: number): string {
  const start = new Date(startIso);
  const today = new Date(now);

  if (isSameLocalDay(start, today)) return t('day.today');

  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  if (isSameLocalDay(start, tomorrow)) return t('day.tomorrow');

  return formatters(getLocaleProfile()).weekday.format(start);
}

/**
 * Countdown text. Switches to m:ss inside the last hour because that is when the
 * seconds start to matter to the person watching; showing them an hour out would
 * just be noise ticking in their pocket. Latin digits across locales so the
 * tabular-figure alignment holds.
 */
export function formatCountdown(ms: number): string {
  const clamped = Math.max(0, ms);

  if (clamped >= HOUR) {
    // Round to whole minutes first, then split - rounding the remainder on its own
    // can carry to 60 and render "1h 60m".
    const totalMinutes = Math.round(clamped / MINUTE);
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    return minutes === 0 ? `${hours}h` : `${hours}h ${minutes}m`;
  }

  const totalSeconds = Math.ceil(clamped / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

/** Screen reader copy. A ticking m:ss would be announced digit by digit. */
export function describeCountdownForA11y(ms: number): string {
  const minutes = Math.ceil(Math.max(0, ms) / MINUTE);
  if (minutes <= 1) return t('a11y.countdownSoon');
  return t('a11y.countdown', { minutes });
}
