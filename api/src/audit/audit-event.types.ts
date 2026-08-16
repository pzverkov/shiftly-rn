// `hash` covers every other field including `previousHash`, forming a chain.
// entityType/entityId/actor are plain strings (not domain types) so this module has no
// dependency on any feature's data model.
export type AuditEvent = {
  id: string;
  timestamp: string;
  actor: string;
  action: string;
  entityType: string;
  entityId: string | null;
  payload: unknown;
  previousHash: string;
  hash: string;
};

export type NewAuditEvent = {
  actor: string;
  action: string;
  entityType: string;
  entityId: string | null;
  payload: unknown;
};

export type AuditEventFilter = {
  entityType?: string;
  entityId?: string;
  actor?: string;
};

export type AuditVerifyResult = {
  valid: boolean;
  brokenAtId: string | null;
};
