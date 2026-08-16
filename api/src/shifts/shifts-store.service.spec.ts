import { ShiftsStoreService } from './shifts-store.service';
import type { Break } from './shift.types';
import { makeShift } from '../testing/shift-fixtures';

describe('ShiftsStoreService', () => {
  let store: ShiftsStoreService;

  beforeEach(() => {
    store = new ShiftsStoreService();
  });

  it('saves and retrieves a shift by id', () => {
    const shift = makeShift();
    store.saveShift(shift);
    expect(store.getShift('shift-1')).toEqual(shift);
  });

  it('returns null for an unknown shift id', () => {
    expect(store.getShift('nope')).toBeNull();
  });

  it('lists only shifts for the given user, sorted by start date', () => {
    store.saveShift(makeShift({ id: 's2', startDate: '2026-07-18T00:00:00.000Z' }));
    store.saveShift(makeShift({ id: 's1', startDate: '2026-07-16T00:00:00.000Z' }));
    store.saveShift(makeShift({ id: 'other-user', userId: 'someone-else' }));

    const listed = store.listShiftsForUser('user-demo');
    expect(listed.map((s) => s.id)).toEqual(['s1', 's2']);
  });

  it('adds and lists breaks for a shift, oldest first', () => {
    const b1: Break = { id: 'b1', shiftId: 'shift-1', startedAt: '2026-07-16T16:00:00.000Z', endedAt: null };
    const b2: Break = { id: 'b2', shiftId: 'shift-1', startedAt: '2026-07-16T15:00:00.000Z', endedAt: '2026-07-16T15:05:00.000Z' };
    store.addBreak(b1);
    store.addBreak(b2);

    expect(store.listBreaks('shift-1').map((b) => b.id)).toEqual(['b2', 'b1']);
  });

  it('finds the one active (unended) break for a shift', () => {
    store.addBreak({ id: 'b1', shiftId: 'shift-1', startedAt: '2026-07-16T15:00:00.000Z', endedAt: '2026-07-16T15:05:00.000Z' });
    store.addBreak({ id: 'b2', shiftId: 'shift-1', startedAt: '2026-07-16T16:00:00.000Z', endedAt: null });

    expect(store.getActiveBreak('shift-1')?.id).toBe('b2');
  });

  it('returns null when no break is active', () => {
    expect(store.getActiveBreak('shift-1')).toBeNull();
  });

  it('persists an update to an existing break in place, keeping list order', () => {
    const b1: Break = { id: 'b1', shiftId: 'shift-1', startedAt: '2026-07-16T15:00:00.000Z', endedAt: null };
    const b2: Break = { id: 'b2', shiftId: 'shift-1', startedAt: '2026-07-16T16:00:00.000Z', endedAt: null };
    store.addBreak(b1);
    store.addBreak(b2);

    store.saveBreak({ ...b1, endedAt: '2026-07-16T15:05:00.000Z' });

    const listed = store.listBreaks('shift-1');
    expect(listed.map((b) => b.id)).toEqual(['b1', 'b2']);
    expect(listed.find((b) => b.id === 'b1')?.endedAt).toBe('2026-07-16T15:05:00.000Z');
  });

  it('is a no-op when saving a break that was never added', () => {
    expect(() => store.saveBreak({ id: 'ghost', shiftId: 'shift-1', startedAt: '2026-07-16T15:00:00.000Z', endedAt: null })).not.toThrow();
    expect(store.listBreaks('shift-1')).toEqual([]);
  });
});
