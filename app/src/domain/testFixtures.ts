import type { Shift } from './shift';

/** Mirrors the shape the API actually returns (api/src/shifts/shifts-fixtures.provider.ts). */
export function makeShift(overrides: Partial<Shift> = {}): Shift {
  const startDate = overrides.startDate ?? '2026-07-16T14:00:00.000Z';
  return {
    id: 'shift-1',
    userId: 'user-demo',
    brand: { id: 'brand-kitsune-madrid', name: 'Kitsune de Madrid' },
    branch: {
      id: 'branch-malasana',
      name: 'Malasaña',
      location: { lat: 40.4262, lng: -3.7038 },
    },
    startDate,
    endDate: new Date(new Date(startDate).getTime() + 8 * 60 * 60 * 1000).toISOString(),
    startedAt: null,
    finishedAt: null,
    startedAtLocation: null,
    finishedAtLocation: null,
    ...overrides,
  };
}

export const at = (iso: string): number => new Date(iso).getTime();
