import type { AuditEvent, AuditEventFilter, AuditVerifyResult, NewAuditEvent } from './audit-event.types';

// DI token: swap the backing store by rebinding this in AuditModule.
export abstract class AuditLog {
  abstract record(event: NewAuditEvent): AuditEvent;
  abstract listEvents(filter?: AuditEventFilter): AuditEvent[];
  abstract verify(): AuditVerifyResult;
}
