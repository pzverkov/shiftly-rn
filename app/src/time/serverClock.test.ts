import {
  getOffsetMs,
  resetServerClock,
  sampleServerDate,
  serverNow,
  subscribeServerClock,
} from './serverClock';

/**
 * The failure this guards against is not subtle: if the offset is ever applied
 * wrongly, the countdown unlocks the clock-in button at the wrong minute and the
 * timestamp we record for a shift is wrong. Both are silent - nothing throws.
 */

const DEVICE_NOW = new Date('2026-07-16T12:00:00.000Z').getTime();

describe('serverClock', () => {
  beforeEach(() => {
    resetServerClock();
    jest.useFakeTimers().setSystemTime(DEVICE_NOW);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('is plain device time until a response has been seen', () => {
    expect(serverNow()).toBe(DEVICE_NOW);
  });

  it('corrects towards the server when the device is behind', () => {
    sampleServerDate(new Date(DEVICE_NOW + 90_000).toUTCString());

    expect(getOffsetMs()).toBe(90_000);
    expect(serverNow()).toBe(DEVICE_NOW + 90_000);
  });

  it('corrects towards the server when the device is ahead', () => {
    sampleServerDate(new Date(DEVICE_NOW - 45_000).toUTCString());

    expect(serverNow()).toBe(DEVICE_NOW - 45_000);
  });

  it('handles a device whose clock is years wrong, which is the case that matters', () => {
    // A phone that ran flat can boot to a bogus time until NTP catches up. This is
    // the whole reason the offset exists rather than trusting Date.now().
    jest.setSystemTime(new Date('1970-01-01T00:00:00.000Z').getTime());
    const trueNow = new Date('2026-07-16T12:00:00.000Z').getTime();

    sampleServerDate(new Date(trueNow).toUTCString());

    expect(serverNow()).toBe(trueNow);
  });

  it('ignores a missing header rather than resetting the offset it already has', () => {
    sampleServerDate(new Date(DEVICE_NOW + 60_000).toUTCString());
    sampleServerDate(null);

    expect(serverNow()).toBe(DEVICE_NOW + 60_000);
  });

  it('ignores an unparseable header instead of poisoning the clock with NaN', () => {
    sampleServerDate(new Date(DEVICE_NOW + 60_000).toUTCString());
    sampleServerDate('not a date');

    // The naive version assigns NaN here and every downstream comparison silently
    // becomes false, which would freeze the countdown forever.
    expect(Number.isNaN(serverNow())).toBe(false);
    expect(serverNow()).toBe(DEVICE_NOW + 60_000);
  });

  it('tracks the most recent sample, so a resynced server clock wins', () => {
    sampleServerDate(new Date(DEVICE_NOW + 60_000).toUTCString());
    sampleServerDate(new Date(DEVICE_NOW + 5_000).toUTCString());

    expect(serverNow()).toBe(DEVICE_NOW + 5_000);
  });

  it('advances with the device clock between samples', () => {
    sampleServerDate(new Date(DEVICE_NOW + 60_000).toUTCString());

    jest.advanceTimersByTime(30_000);

    // The offset is fixed; the clock still has to tick.
    expect(serverNow()).toBe(DEVICE_NOW + 90_000);
  });

  describe('subscription', () => {
    it('notifies subscribers on a sample, so the countdown corrects immediately', () => {
      const listener = jest.fn();
      subscribeServerClock(listener);

      sampleServerDate(new Date(DEVICE_NOW + 60_000).toUTCString());

      expect(listener).toHaveBeenCalledTimes(1);
    });

    it('stops notifying after unsubscribe', () => {
      const listener = jest.fn();
      const unsubscribe = subscribeServerClock(listener);
      unsubscribe();

      sampleServerDate(new Date(DEVICE_NOW + 60_000).toUTCString());

      expect(listener).not.toHaveBeenCalled();
    });
  });
});
