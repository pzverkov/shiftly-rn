import { InMemoryAuditLog } from './in-memory-audit-log.service';

describe('InMemoryAuditLog', () => {
  let log: InMemoryAuditLog;

  beforeEach(() => {
    log = new InMemoryAuditLog();
  });

  it('records an event with a hash chained to the genesis hash', () => {
    const entry = log.record({ actor: 'user-demo', action: 'POST start', entityType: 'shifts', entityId: 's1', payload: { ok: true } });
    expect(entry.previousHash).toBe('0'.repeat(64));
    expect(entry.hash).toMatch(/^[0-9a-f]{64}$/);
  });

  it('chains each entry to the previous entry hash', () => {
    const first = log.record({ actor: 'a', action: 'a1', entityType: 'shifts', entityId: 's1', payload: 1 });
    const second = log.record({ actor: 'a', action: 'a2', entityType: 'shifts', entityId: 's1', payload: 2 });
    expect(second.previousHash).toBe(first.hash);
  });

  it('verifies a clean chain as valid', () => {
    log.record({ actor: 'a', action: 'a1', entityType: 'shifts', entityId: 's1', payload: 1 });
    log.record({ actor: 'a', action: 'a2', entityType: 'shifts', entityId: 's1', payload: 2 });
    expect(log.verify()).toEqual({ valid: true, brokenAtId: null });
  });

  it('verifies an empty chain as valid', () => {
    expect(log.verify()).toEqual({ valid: true, brokenAtId: null });
  });

  it('detects a tampered payload', () => {
    log.record({ actor: 'a', action: 'a1', entityType: 'shifts', entityId: 's1', payload: 1 });
    const tampered = log.record({ actor: 'a', action: 'a2', entityType: 'shifts', entityId: 's1', payload: 2 });

    // simulate an in-place edit of a past entry, bypassing the public API
    (log as unknown as { events: { payload: unknown }[] }).events[1].payload = 999;

    const result = log.verify();
    expect(result.valid).toBe(false);
    expect(result.brokenAtId).toBe(tampered.id);
  });

  it('detects a deleted entry breaking the chain', () => {
    log.record({ actor: 'a', action: 'a1', entityType: 'shifts', entityId: 's1', payload: 1 });
    const second = log.record({ actor: 'a', action: 'a2', entityType: 'shifts', entityId: 's1', payload: 2 });

    (log as unknown as { events: unknown[] }).events.shift();

    const result = log.verify();
    expect(result.valid).toBe(false);
    expect(result.brokenAtId).toBe(second.id);
  });

  it('filters events by entityId', () => {
    log.record({ actor: 'a', action: 'a1', entityType: 'shifts', entityId: 's1', payload: 1 });
    log.record({ actor: 'a', action: 'a2', entityType: 'shifts', entityId: 's2', payload: 2 });
    expect(log.listEvents({ entityId: 's1' }).map((e) => e.entityId)).toEqual(['s1']);
  });

  it('filters events by actor', () => {
    log.record({ actor: 'alice', action: 'a1', entityType: 'shifts', entityId: 's1', payload: 1 });
    log.record({ actor: 'bob', action: 'a2', entityType: 'shifts', entityId: 's1', payload: 2 });
    expect(log.listEvents({ actor: 'bob' })).toHaveLength(1);
  });
});
