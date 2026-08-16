import { toDate, toGeoPoint, resolveUserId } from './shifts-request.utils';

describe('toDate', () => {
  it('defaults to now when omitted', () => {
    const before = Date.now();
    const parsed = toDate(undefined);
    expect(parsed.getTime()).toBeGreaterThanOrEqual(before);
  });

  it('parses a valid ISO string', () => {
    expect(toDate('2026-07-16T14:00:00.000Z').toISOString()).toBe('2026-07-16T14:00:00.000Z');
  });
});

describe('toGeoPoint', () => {
  it('returns null for a missing location', () => {
    expect(toGeoPoint(undefined)).toBeNull();
  });

  it('carries a validated { lat, lng } through unchanged', () => {
    expect(toGeoPoint({ lat: 51.5, lng: -0.1 })).toEqual({ lat: 51.5, lng: -0.1 });
  });
});

describe('resolveUserId', () => {
  it('prefers the body userId', () => {
    expect(resolveUserId({ userId: 'from-body' }, { userId: 'from-query' }, 'default')).toBe('from-body');
  });

  it('falls back to the query userId', () => {
    expect(resolveUserId({}, { userId: 'from-query' }, 'default')).toBe('from-query');
  });

  it('falls back to the default when neither is present', () => {
    expect(resolveUserId({}, {}, 'default')).toBe('default');
  });
});
