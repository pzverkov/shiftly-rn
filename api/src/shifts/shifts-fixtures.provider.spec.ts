import { ShiftsFixturesProvider } from './shifts-fixtures.provider';
import { ShiftsStoreService } from './shifts-store.service';

describe('ShiftsFixturesProvider', () => {
  it('generates at least one shift, starting 16 minutes from now, on today', () => {
    const store = new ShiftsStoreService();
    const provider = new ShiftsFixturesProvider(store);
    const now = new Date('2026-07-16T10:00:00.000Z');

    const shifts = provider.generateFixtures(now);

    expect(shifts.length).toBeGreaterThanOrEqual(1);
    const first = shifts[0];
    expect(new Date(first.startDate).getTime()).toBe(now.getTime() + 16 * 60 * 1000);
    expect(new Date(first.startDate).toDateString()).toBe(now.toDateString());
  });

  it('uses all three demo brands at least once across many runs', () => {
    const store = new ShiftsStoreService();
    const provider = new ShiftsFixturesProvider(store);
    const brandNames = new Set<string>();
    for (let i = 0; i < 50; i++) {
      for (const shift of provider.generateFixtures(new Date())) {
        brandNames.add(shift.brand.name);
      }
    }
    expect(brandNames.has('Kitsune de Madrid')).toBe(true);
    expect(brandNames.has('La Grulla Dorada')).toBe(true);
    expect(brandNames.has('Tsuki no Té')).toBe(true);
    expect(brandNames.has('Nory Burger')).toBe(false);
  });

  it('persists every generated shift into the store', () => {
    const store = new ShiftsStoreService();
    const provider = new ShiftsFixturesProvider(store);
    const shifts = provider.generateFixtures(new Date(), 'user-demo');

    for (const shift of shifts) {
      expect(store.getShift(shift.id)).toEqual(shift);
    }
  });

  it('exposes the default demo user id', () => {
    const store = new ShiftsStoreService();
    const provider = new ShiftsFixturesProvider(store);
    expect(provider.DEFAULT_USER_ID).toBe('user-demo');
  });
});
