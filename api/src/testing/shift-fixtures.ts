import type { Branch, GeoPoint, Shift } from '../shifts/shift.types';

export const BRANCH: Branch = {
  id: 'branch-malasana',
  name: 'Malasaña',
  location: { lat: 40.4262, lng: -3.7038 },
};

export const HERE: GeoPoint = BRANCH.location;

export function makeShift(overrides: Partial<Shift> = {}): Shift {
  const startDate = overrides.startDate ?? '2026-07-16T14:00:00.000Z';
  return {
    id: 'shift-1',
    userId: 'user-demo',
    brand: { id: 'brand-kitsune-madrid', name: 'Kitsune de Madrid' },
    branch: BRANCH,
    startDate,
    endDate: new Date(new Date(startDate).getTime() + 8 * 60 * 60 * 1000).toISOString(),
    startedAt: null,
    finishedAt: null,
    startedAtLocation: null,
    finishedAtLocation: null,
    ...overrides,
  };
}
