import { createHash, randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { AuditLog } from './audit-log';
import type { AuditEvent, AuditEventFilter, AuditVerifyResult, NewAuditEvent } from './audit-event.types';

const GENESIS_HASH = '0'.repeat(64);

// Hashed via JSON.stringify, so payload key order must stay stable across writers.
function computeHash(entry: Omit<AuditEvent, 'hash'>): string {
  const canonical = {
    id: entry.id,
    timestamp: entry.timestamp,
    previousHash: entry.previousHash,
    actor: entry.actor,
    action: entry.action,
    entityType: entry.entityType,
    entityId: entry.entityId,
    payload: entry.payload,
  };
  return createHash('sha256').update(JSON.stringify(canonical)).digest('hex');
}

@Injectable()
export class InMemoryAuditLog extends AuditLog {
  private readonly events: AuditEvent[] = [];

  record(event: NewAuditEvent): AuditEvent {
    const previousHash = this.events.length > 0 ? this.events[this.events.length - 1].hash : GENESIS_HASH;
    const withoutHash: Omit<AuditEvent, 'hash'> = {
      id: randomUUID(),
      timestamp: new Date().toISOString(),
      previousHash,
      ...event,
    };
    const entry: AuditEvent = { ...withoutHash, hash: computeHash(withoutHash) };
    this.events.push(entry);
    return entry;
  }

  listEvents(filter: AuditEventFilter = {}): AuditEvent[] {
    return this.events.filter(
      (event) =>
        (filter.entityType == null || event.entityType === filter.entityType) &&
        (filter.entityId == null || event.entityId === filter.entityId) &&
        (filter.actor == null || event.actor === filter.actor),
    );
  }

  verify(): AuditVerifyResult {
    let expectedPreviousHash = GENESIS_HASH;
    for (const event of this.events) {
      if (event.previousHash !== expectedPreviousHash) return { valid: false, brokenAtId: event.id };
      const { hash, ...withoutHash } = event;
      if (computeHash(withoutHash) !== hash) return { valid: false, brokenAtId: event.id };
      expectedPreviousHash = hash;
    }
    return { valid: true, brokenAtId: null };
  }
}
