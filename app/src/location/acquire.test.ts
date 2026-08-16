import * as Location from 'expo-location';

import { BRANCH_RADIUS_METERS, acquireLocation } from './acquire';

jest.mock('expo-location');

const mocked = jest.mocked(Location);

const SOHO = { latitude: 51.5142, longitude: -0.1316 };

function position(accuracy: number | null) {
  return {
    coords: { ...SOHO, accuracy, altitude: null, altitudeAccuracy: null, heading: null, speed: null },
    timestamp: 0,
  } as Location.LocationObject;
}

function granted(canAskAgain = true) {
  return { granted: true, canAskAgain, status: 'granted', expires: 'never' } as never;
}

beforeEach(() => {
  jest.clearAllMocks();
  mocked.hasServicesEnabledAsync.mockResolvedValue(true);
  mocked.requestForegroundPermissionsAsync.mockResolvedValue(granted());
  mocked.getLastKnownPositionAsync.mockResolvedValue(null);
  mocked.getCurrentPositionAsync.mockResolvedValue(position(10));
});

describe('acquireLocation', () => {
  describe('preconditions', () => {
    it('reports services being off, and does not ask for permission first', async () => {
      mocked.hasServicesEnabledAsync.mockResolvedValue(false);

      const result = await acquireLocation();

      expect(result).toEqual({ kind: 'services-off' });
      // Asking for permission here would put a dialog in front of the user that
      // cannot fix their problem.
      expect(mocked.requestForegroundPermissionsAsync).not.toHaveBeenCalled();
    });

    it('distinguishes a refusal we can ask about again from one only Settings can undo', async () => {
      mocked.requestForegroundPermissionsAsync.mockResolvedValue({
        granted: false,
        canAskAgain: true,
        status: 'denied',
        expires: 'never',
      } as never);

      await expect(acquireLocation()).resolves.toEqual({ kind: 'denied', canAskAgain: true });

      mocked.requestForegroundPermissionsAsync.mockResolvedValue({
        granted: false,
        canAskAgain: false,
        status: 'denied',
        expires: 'never',
      } as never);

      await expect(acquireLocation()).resolves.toEqual({ kind: 'denied', canAskAgain: false });
    });

    it('does not reach for the GPS when permission was refused', async () => {
      mocked.requestForegroundPermissionsAsync.mockResolvedValue({
        granted: false,
        canAskAgain: true,
        status: 'denied',
        expires: 'never',
      } as never);

      await acquireLocation();

      expect(mocked.getLastKnownPositionAsync).not.toHaveBeenCalled();
      expect(mocked.getCurrentPositionAsync).not.toHaveBeenCalled();
    });
  });

  describe('the fast path', () => {
    it('uses a recent cached fix and skips the expensive call entirely', async () => {
      mocked.getLastKnownPositionAsync.mockResolvedValue(position(12));

      const result = await acquireLocation();

      expect(result).toEqual({
        kind: 'ok',
        fix: { point: { lat: SOHO.latitude, lng: SOHO.longitude }, accuracy: 12, isCoarse: false },
      });
      // The whole point of the fast path: no GPS spin-up.
      expect(mocked.getCurrentPositionAsync).not.toHaveBeenCalled();
    });

    it('only accepts a cached fix precise enough to clear the geofence', async () => {
      await acquireLocation();

      // Mirrors the server's 50m rule - a cached fix vaguer than the branch radius
      // is not worth having, so we let the OS reject it rather than filtering later.
      expect(mocked.getLastKnownPositionAsync).toHaveBeenCalledWith({
        maxAge: 30_000,
        requiredAccuracy: BRANCH_RADIUS_METERS,
      });
    });

    it('falls through to a fresh fix when nothing recent is cached', async () => {
      const result = await acquireLocation();

      expect(mocked.getCurrentPositionAsync).toHaveBeenCalled();
      expect(result).toMatchObject({ kind: 'ok' });
    });
  });

  describe('when the GPS will not cooperate', () => {
    beforeEach(() => jest.useFakeTimers());
    afterEach(() => jest.useRealTimers());

    it('gives up after 10 seconds instead of hanging on a cold fix', async () => {
      // The real failure this models: indoors, or a phone in battery saver, where
      // getCurrentPositionAsync simply never resolves. It has no timeout of its own.
      mocked.getCurrentPositionAsync.mockReturnValue(new Promise(() => {}) as never);

      const pending = acquireLocation();
      await jest.advanceTimersByTimeAsync(10_000);

      await expect(pending).resolves.toEqual({ kind: 'timeout' });
    });

    it('still resolves if the fix lands just inside the deadline', async () => {
      mocked.getCurrentPositionAsync.mockReturnValue(
        new Promise((resolve) => setTimeout(() => resolve(position(20)), 9_000)) as never,
      );

      const pending = acquireLocation();
      await jest.advanceTimersByTimeAsync(9_000);

      await expect(pending).resolves.toMatchObject({ kind: 'ok' });
    });
  });

  describe('accuracy', () => {
    it('flags a fix too vague to sit inside the branch radius', async () => {
      // iOS with Precise Location off, or an indoor network-only fix. The point may
      // still be right, so this is a flag rather than a rejection - it is what lets
      // the UI explain an OUT_OF_RANGE honestly.
      mocked.getCurrentPositionAsync.mockResolvedValue(position(150));

      const result = await acquireLocation();

      expect(result).toMatchObject({ fix: { accuracy: 150, isCoarse: true } });
    });

    it('does not flag a fix exactly at the radius', async () => {
      mocked.getCurrentPositionAsync.mockResolvedValue(position(BRANCH_RADIUS_METERS));

      expect(await acquireLocation()).toMatchObject({ fix: { isCoarse: false } });
    });

    it('treats an unreported accuracy as not-coarse rather than guessing', async () => {
      // Some platforms report null. Assuming the worst would block clock-ins that
      // would have succeeded; the server is the authority either way.
      mocked.getCurrentPositionAsync.mockResolvedValue(position(null));

      expect(await acquireLocation()).toMatchObject({
        fix: { accuracy: null, isCoarse: false },
      });
    });
  });

  it('surfaces an unexpected platform failure instead of throwing into the UI', async () => {
    mocked.getCurrentPositionAsync.mockRejectedValue(new Error('Location provider crashed'));

    await expect(acquireLocation()).resolves.toEqual({
      kind: 'unavailable',
      message: 'Location provider crashed',
    });
  });

  // The signature promises a total LocationResult and the caller has no catch. A
  // rejection escaping from the permission calls (Android throws when a request is
  // already in flight) would wedge the clock-in button on its spinner forever.
  it('stays total when the permission request itself rejects', async () => {
    mocked.requestForegroundPermissionsAsync.mockRejectedValue(new Error('request already in progress'));

    await expect(acquireLocation()).resolves.toEqual({
      kind: 'unavailable',
      message: 'request already in progress',
    });
  });

  it('stays total when the services check rejects', async () => {
    mocked.hasServicesEnabledAsync.mockRejectedValue(new Error('provider error'));

    await expect(acquireLocation()).resolves.toEqual({
      kind: 'unavailable',
      message: 'provider error',
    });
  });

  it('survives a non-Error rejection', async () => {
    mocked.getCurrentPositionAsync.mockRejectedValue('kernel said no');

    await expect(acquireLocation()).resolves.toEqual({
      kind: 'unavailable',
      message: 'Location is unavailable',
    });
  });
});
