import * as Location from 'expo-location';

import { SHIFT_MAX_DISTANCE_METERS, type GeoPoint } from '../domain/shift';

/**
 * Getting a location fix, defensively.
 *
 * `getCurrentPositionAsync` has no timeout option and asks the OS for a fresh
 * fix. Indoors - a basement kitchen, a walk-in fridge - or on a phone in battery
 * saver, that can take tens of seconds or never resolve at all. A bare call is
 * the naive failure mode here, and it strands the user on a spinner.
 *
 * So: try the cheap thing first, race the expensive thing against a clock, and
 * describe the failure precisely enough that the UI can tell the user what to
 * actually do about it.
 */

/**
 * The accuracy bar a fix has to clear, which is the geofence itself: a fix whose
 * error radius exceeds the branch radius cannot tell us which side of it we are on.
 * Re-exported from the domain rather than restated, so the two cannot drift.
 */
export const BRANCH_RADIUS_METERS = SHIFT_MAX_DISTANCE_METERS;

const LAST_KNOWN_MAX_AGE_MS = 30_000;
const CURRENT_POSITION_TIMEOUT_MS = 10_000;

export type LocationFix = {
  point: GeoPoint;
  /** Radius of uncertainty in metres, if the platform reported one. */
  accuracy: number | null;
  /** True when accuracy is too coarse to sit inside the branch radius. */
  isCoarse: boolean;
};

export type LocationResult =
  | { kind: 'ok'; fix: LocationFix }
  /** Permission refused. Only Settings can undo this. */
  | { kind: 'denied'; canAskAgain: boolean }
  /** Location services are off device-wide. */
  | { kind: 'services-off' }
  /** No fix within the timeout. Usually indoors, or a cold GPS. */
  | { kind: 'timeout' }
  /** The platform failed in a way we have no specific advice for. */
  | { kind: 'unavailable'; message: string };

function toFix(position: Location.LocationObject): LocationFix {
  const accuracy = position.coords.accuracy ?? null;
  return {
    point: { lat: position.coords.latitude, lng: position.coords.longitude },
    accuracy,
    isCoarse: accuracy !== null && accuracy > BRANCH_RADIUS_METERS,
  };
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T | 'timeout'> {
  let timer: ReturnType<typeof setTimeout> | undefined;

  const timeout = new Promise<'timeout'>((resolve) => {
    timer = setTimeout(() => resolve('timeout'), ms);
  });

  // Racing alone leaves the loser's timer armed. It resolves into nothing, but it
  // keeps the runtime awake for 10s after every successful fix - which is every
  // clock-in.
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

export async function acquireLocation(): Promise<LocationResult> {
  // Everything is inside the try so this stays total: the signature promises a
  // LocationResult and the caller renders it as one, with no catch of its own.
  // The permission calls can genuinely reject - Android throws if a request is
  // already in flight, and the services check can fail on a provider error - and
  // an escaping rejection would wedge the button on its spinner forever.
  try {
    // Ask before requesting permission: if the user has location switched off
    // entirely, the permission dialog is not the problem and not the fix.
    const servicesEnabled = await Location.hasServicesEnabledAsync();
    if (!servicesEnabled) return { kind: 'services-off' };

    const permission = await Location.requestForegroundPermissionsAsync();
    if (!permission.granted) {
      return { kind: 'denied', canAskAgain: permission.canAskAgain };
    }

    // A recent fix the OS already has costs nothing and is usually good enough.
    // `requiredAccuracy` mirrors the branch radius, so we only take a cached fix
    // precise enough to plausibly clear the geofence.
    const lastKnown = await Location.getLastKnownPositionAsync({
      maxAge: LAST_KNOWN_MAX_AGE_MS,
      requiredAccuracy: BRANCH_RADIUS_METERS,
    });
    if (lastKnown) return { kind: 'ok', fix: toFix(lastKnown) };

    // Balanced rather than Highest: within-50m is all the server checks, and
    // Highest spins the GPS harder for accuracy we would only throw away.
    const current = await withTimeout(
      Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }),
      CURRENT_POSITION_TIMEOUT_MS,
    );
    if (current === 'timeout') return { kind: 'timeout' };

    return { kind: 'ok', fix: toFix(current) };
  } catch (error) {
    return {
      kind: 'unavailable',
      message: error instanceof Error ? error.message : 'Location is unavailable',
    };
  }
}
