import {
  describeCountdownForA11y,
  formatCountdown,
  formatDistance,
  formatShiftDay,
  formatTime,
  formatTimeRange,
} from './format';
import { localeProfiles, resetLocale, setActiveLocale } from '../../i18n';

const at = (iso: string) => new Date(iso).getTime();

describe('formatCountdown', () => {
  it('counts seconds inside the last minute', () => {
    expect(formatCountdown(65_000)).toBe('1:05');
    expect(formatCountdown(9_000)).toBe('0:09');
  });

  it('pads seconds so the text does not change width as it ticks', () => {
    // Paired with tabular figures - together they stop the countdown jittering.
    expect(formatCountdown(61_000)).toBe('1:01');
  });

  it('rounds up, so it never shows 0:00 while there is still time left', () => {
    // Showing 0:00 for a whole second while the button is still disabled reads as
    // a bug to the person staring at it.
    expect(formatCountdown(1)).toBe('0:01');
    expect(formatCountdown(999)).toBe('0:01');
  });

  it('shows exactly 0:00 only at zero', () => {
    expect(formatCountdown(0)).toBe('0:00');
  });

  it('clamps a negative countdown instead of rendering minus signs', () => {
    // The clock can cross the target between a tick and a render.
    expect(formatCountdown(-5_000)).toBe('0:00');
  });

  it('drops to hours and minutes when seconds would just be noise', () => {
    expect(formatCountdown(3 * 3_600_000 + 20 * 60_000)).toBe('3h 20m');
  });

  it('omits the minutes on a whole hour', () => {
    expect(formatCountdown(2 * 3_600_000)).toBe('2h');
  });

  it('switches format exactly at the hour boundary', () => {
    expect(formatCountdown(3_600_000)).toBe('1h');
    expect(formatCountdown(3_599_000)).toBe('59:59');
  });

  it('carries the minute rounding into the hour instead of showing 60m', () => {
    // 1h 59m 40s: rounding the remainder alone would print "1h 60m".
    expect(formatCountdown(3_600_000 + 59 * 60_000 + 40_000)).toBe('2h');
  });
});

describe('describeCountdownForA11y', () => {
  it('speaks whole minutes rather than a ticking clock', () => {
    // A screen reader would otherwise announce every second, digit by digit.
    expect(describeCountdownForA11y(3 * 60_000)).toBe('Clock in available in 3 minutes');
  });

  it('avoids saying "0 minutes" or "1 minutes"', () => {
    expect(describeCountdownForA11y(30_000)).toBe('Clock in available in less than a minute');
    expect(describeCountdownForA11y(0)).toBe('Clock in available in less than a minute');
  });
});

describe('formatShiftDay', () => {
  const now = at('2026-07-16T12:00:00.000Z');

  it('names today and tomorrow rather than dating them', () => {
    expect(formatShiftDay('2026-07-16T14:00:00.000Z', now)).toBe('Today');
    expect(formatShiftDay('2026-07-17T09:00:00.000Z', now)).toBe('Tomorrow');
  });

  it('dates anything further out', () => {
    expect(formatShiftDay('2026-07-20T09:00:00.000Z', now)).toBe('Mon 20 Jul');
  });

  it('handles a shift late tonight, which is still today', () => {
    expect(formatShiftDay('2026-07-16T23:30:00.000Z', now)).toBe('Today');
  });

  it('rolls over the month boundary', () => {
    expect(formatShiftDay('2026-08-01T09:00:00.000Z', at('2026-07-31T12:00:00.000Z'))).toBe(
      'Tomorrow',
    );
  });
});

describe('formatTimeRange', () => {
  it('reads as a rota does, on a 24 hour clock', () => {
    expect(formatTimeRange('2026-07-16T14:16:00.000Z', '2026-07-16T22:16:00.000Z')).toBe(
      '14:16 - 22:16',
    );
  });

  it('handles a shift crossing midnight', () => {
    expect(formatTimeRange('2026-07-16T22:00:00.000Z', '2026-07-17T06:00:00.000Z')).toBe(
      '22:00 - 06:00',
    );
  });
});

describe('region-aware time format', () => {
  afterEach(() => resetLocale());

  it('reads 24-hour by default (en-GB)', () => {
    expect(formatTime('2026-07-16T14:16:00.000Z')).toBe('14:16');
  });

  it('reads 12-hour with AM/PM under the US profile', () => {
    setActiveLocale(localeProfiles['en-US']);
    const time = formatTime('2026-07-16T14:16:00.000Z');

    // Substring assertions, not exact: ICU renders the AM/PM separator as a normal
    // space in some versions and U+202F in others, and Node's ICU may differ from
    // Hermes'. The display is unaffected; only exact string equality would be brittle.
    expect(time).toMatch(/2:16/);
    expect(time).toContain('PM');
    expect(time).not.toContain('14:16');
  });
});

describe('formatDistance', () => {
  afterEach(() => resetLocale());

  it('uses metres by default', () => {
    expect(formatDistance(50)).toBe('50 m');
    expect(formatDistance(150)).toBe('150 m');
  });

  it('uses feet under the US profile, rounded to the nearest five', () => {
    setActiveLocale(localeProfiles['en-US']);
    expect(formatDistance(50)).toBe('165 ft'); // 164.04 -> 165
    expect(formatDistance(150)).toBe('490 ft'); // 492.13 -> 490
  });
});
