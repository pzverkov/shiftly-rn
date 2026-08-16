import { ApiError, NetworkError } from '../../api/errors';
import { MIN_MINUTES_BEFORE_BREAK, MIN_MINUTES_BREAK_DURATION } from '../../domain/breaks';
import { SHIFT_FINISH_GRACE_MINUTES, SHIFT_START_WINDOW_MINUTES } from '../../domain/shift';
import { localeProfiles, resetLocale, setActiveLocale } from '../../i18n';
import type { LocationFix } from '../../location/acquire';
import { describeBreakFailure, describeClockInFailure, describeLocationFailure } from './messages';

const preciseFix: LocationFix = {
  point: { lat: 51.5142, lng: -0.1316 },
  accuracy: 8,
  isCoarse: false,
};

const coarseFix: LocationFix = {
  point: { lat: 51.5142, lng: -0.1316 },
  accuracy: 150,
  isCoarse: true,
};

describe('describeClockInFailure', () => {
  /**
   * The case worth the code. The server measures distance from the one point we
   * sent and knows nothing about how sure we were of it, so SHIFT_OUT_OF_RANGE has
   * two meanings: the user is genuinely down the road, or we handed over a fix with
   * a 150m error radius and it missed. Telling someone standing in the kitchen
   * "you're too far from Soho" is both wrong and impossible to act on.
   */
  describe('SHIFT_OUT_OF_RANGE', () => {
    const outOfRange = (details?: Record<string, unknown>) =>
      new ApiError(409, 'SHIFT_OUT_OF_RANGE', 'You must be within 50 metres.', details);

    it('blames the distance when the fix was precise enough to trust', () => {
      const advice = describeClockInFailure(outOfRange({ distanceMeters: 320 }), preciseFix);

      expect(advice.title).toBe('Too far from your branch');
      expect(advice.detail).toContain('320 m');
      expect(advice.canRetry).toBe(true);
    });

    it('blames the uncertainty when the fix was too vague to place the user', () => {
      const advice = describeClockInFailure(outOfRange({ distanceMeters: 320 }), coarseFix);

      expect(advice.title).toBe("Couldn't confirm where you are");
      expect(advice.detail).toContain('150 m');
      expect(advice.detail).toContain('Precise Location');
      // Crucially, it must not claim they are far away - we do not know that.
      expect(advice.detail).not.toContain('320 m');
    });

    it('still explains a coarse fix when the platform reported no accuracy number', () => {
      const advice = describeClockInFailure(outOfRange(), {
        ...coarseFix,
        accuracy: null,
      });

      expect(advice.detail).toContain('Precise Location');
      expect(advice.detail).not.toContain('null');
    });

    it('says the range rule in the localised copy when there is no distance to quote', () => {
      const advice = describeClockInFailure(outOfRange(), preciseFix);

      // The client copy for the code, not the server's English `message`.
      expect(advice.detail).toBe('You need to be at the branch to clock in or out.');
      expect(advice.detail).not.toBe('You must be within 50 metres.');
    });

    it('does not invent precision when no fix was taken at all', () => {
      // The dev override path sends the branch coordinates without a real fix.
      const advice = describeClockInFailure(outOfRange({ distanceMeters: 12 }), null);

      expect(advice.title).toBe('Too far from your branch');
    });

    describe('under the US profile', () => {
      // A US device reads distance and the geofence in feet; the server geofence
      // stays 50m regardless (see decision 23). 50m -> 165ft, 150m -> 490ft.
      beforeEach(() => setActiveLocale(localeProfiles['en-US']));
      afterEach(() => resetLocale());

      it('quotes the distance and the geofence limit in feet', () => {
        const advice = describeClockInFailure(outOfRange({ distanceMeters: 320 }), preciseFix);

        expect(advice.detail).toContain('165 ft');
        expect(advice.detail).not.toContain(' m.');
      });

      it('quotes a coarse fix accuracy in feet', () => {
        const advice = describeClockInFailure(outOfRange({ distanceMeters: 320 }), coarseFix);

        expect(advice.detail).toContain('490 ft');
      });
    });
  });

  it('frames a lost connection as saved, not failed, because the mutation is queued', () => {
    const advice = describeClockInFailure(new NetworkError('offline'), preciseFix);

    expect(advice.title).toBe('No connection');
    expect(advice.detail).toContain('back online');
    // Retrying by hand would be wrong: React Query already owns the replay.
    expect(advice.canRetry).toBe(false);
  });

  it('says a business rejection in the localised copy, not the server English', () => {
    const advice = describeClockInFailure(
      new ApiError(409, 'SHIFT_START_TOO_EARLY', 'A shift can only be started up to 15 minutes before.'),
      preciseFix,
    );

    expect(advice.detail).toBe('You can clock in from 15 minutes before your shift starts.');
    // The server's own English wording is never surfaced.
    expect(advice.detail).not.toContain('A shift can only be started');
    expect(advice.canRetry).toBe(false);
  });

  it('falls back to the server message for a code the client does not know yet', () => {
    // A rule the server ships before a client key exists: show its English text
    // rather than nothing.
    const advice = describeClockInFailure(
      new ApiError(409, 'SHIFT_SOMETHING_NEW' as never, 'A brand new rule was violated.'),
      preciseFix,
    );

    expect(advice.detail).toBe('A brand new rule was violated.');
  });

  it('degrades to something sayable for an unexpected throw', () => {
    const advice = describeClockInFailure(new TypeError('undefined is not an object'), null);

    expect(advice.title).toBe('Something went wrong');
    // Never leak a stack trace or an internal message into the UI.
    expect(advice.detail).not.toContain('undefined is not an object');
  });
});

describe('describeBreakFailure', () => {
  it('frames a lost connection as queued, since the break mutation replays', () => {
    const advice = describeBreakFailure(new NetworkError('offline'));

    expect(advice.title).toBe('No connection');
    expect(advice.detail).toContain('back online');
    // React Query owns the replay, so a manual retry would be wrong.
    expect(advice.canRetry).toBe(false);
  });

  it('says a business rejection in the localised copy, not the server English', () => {
    const advice = describeBreakFailure(
      new ApiError(409, 'BREAK_LIMIT_REACHED', 'You have already taken two breaks.'),
    );

    expect(advice.detail).toBe("You've already taken both breaks for this shift.");
    expect(advice.detail).not.toBe('You have already taken two breaks.');
    expect(advice.canRetry).toBe(false);
  });

  it('degrades to something sayable for an unexpected throw', () => {
    const advice = describeBreakFailure(new TypeError('undefined is not an object'));

    expect(advice.title).toBe('Something went wrong');
    expect(advice.detail).not.toContain('undefined is not an object');
  });
});

describe('describeLocationFailure', () => {
  it('offers another try when the user can still be asked, with no Settings detour', () => {
    const advice = describeLocationFailure({ kind: 'denied', canAskAgain: true });

    expect(advice.canRetry).toBe(true);
    expect(advice.action).toBeUndefined();
    expect(advice.detail).not.toContain('Settings');
  });

  it('routes a blocked permission to Settings, the only thing that recovers it', () => {
    const advice = describeLocationFailure({ kind: 'denied', canAskAgain: false });

    expect(advice.detail).toContain('Settings');
    expect(advice.canRetry).toBe(false);
    // A retry cannot re-prompt once blocked, so offer the recovery that works.
    expect(advice.action).toBe('openSettings');
  });

  it('offers Settings when location services are off device-wide', () => {
    const advice = describeLocationFailure({ kind: 'services-off' });

    expect(advice.detail).toContain('Location Services');
    expect(advice.action).toBe('openSettings');
  });

  it('explains a timeout as a signal problem, retryable and with no Settings action', () => {
    const advice = describeLocationFailure({ kind: 'timeout' });

    expect(advice.detail).toContain('window');
    expect(advice.canRetry).toBe(true);
    expect(advice.action).toBeUndefined();
  });

  it('shows a translated line for an unavailable provider, not the raw platform message', () => {
    const advice = describeLocationFailure({ kind: 'unavailable', message: 'Provider crashed' });

    // The technical platform string is logged elsewhere, never shown.
    expect(advice.detail).not.toContain('Provider crashed');
    expect(advice.detail.length).toBeGreaterThan(0);
    expect(advice.canRetry).toBe(true);
  });
});

/**
 * Copy that quotes a rule has to quote the constant, not a number typed into the
 * string. These thresholds were spelled out in the translations, in both locales,
 * so changing `SHIFT_START_WINDOW_MINUTES` left the user reading "15 minutes"
 * while the app enforced something else - a silent failure in six places at once.
 * Asserting against the constant rather than a literal is the whole point: hardcode
 * "15" here and the test rots with the copy.
 */
describe('rejection copy quotes the rule constants', () => {
  afterEach(resetLocale);

  const cases = [
    ['SHIFT_START_TOO_EARLY', SHIFT_START_WINDOW_MINUTES],
    ['SHIFT_FINISH_TOO_LATE', SHIFT_FINISH_GRACE_MINUTES],
    ['BREAK_TOO_SOON_AFTER_START', MIN_MINUTES_BEFORE_BREAK],
    ['BREAK_END_TOO_SOON', MIN_MINUTES_BREAK_DURATION],
  ] as const;

  it.each(cases)('%s quotes %i minutes', (code, minutes) => {
    const advice = describeClockInFailure(new ApiError(409, code, 'server text'), null);

    expect(advice.detail).toContain(String(minutes));
    // An unsubstituted placeholder renders literally, which the contains-check alone
    // would not catch when the constant happens to appear elsewhere in the sentence.
    expect(advice.detail).not.toContain('{{minutes}}');
  });

  it('substitutes in Hebrew too, where the placeholder is easiest to translate away', () => {
    setActiveLocale(localeProfiles['he-IL']);
    const advice = describeClockInFailure(
      new ApiError(409, 'SHIFT_START_TOO_EARLY', 'server text'),
      null,
    );

    expect(advice.detail).toContain(String(SHIFT_START_WINDOW_MINUTES));
    expect(advice.detail).not.toContain('{{minutes}}');
  });
});
