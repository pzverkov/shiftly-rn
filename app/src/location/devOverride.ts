import { useSyncExternalStore } from 'react';

/**
 * Pretend to be standing at the branch.
 *
 * The API's fixtures put every branch in Spain and enforce a 50m geofence, so a
 * simulator's default location (Cupertino) can never clock in. Rather than
 * weaken the geofence handling to make the demo work, the real location path
 * stays exactly as it is and this substitutes the branch coordinates ahead of it.
 *
 * `__DEV__` guards every read, so this cannot be switched on in a release build.
 */

let enabled = __DEV__;
const listeners = new Set<() => void>();

function emit(): void {
  listeners.forEach((listener) => listener());
}

export function isDevLocationOverrideEnabled(): boolean {
  return __DEV__ && enabled;
}

export function setDevLocationOverride(next: boolean): void {
  if (!__DEV__) return;
  enabled = next;
  emit();
}

// Hoisted so its identity is stable - an inline subscribe re-subscribes on every
// render, tearing the listener down and re-adding it each time.
function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useDevLocationOverride(): [boolean, (next: boolean) => void] {
  const value = useSyncExternalStore(subscribe, isDevLocationOverrideEnabled, () => false);
  return [value, setDevLocationOverride];
}
