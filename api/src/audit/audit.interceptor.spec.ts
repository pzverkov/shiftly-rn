import { Observable, of } from 'rxjs';
import type { CallHandler, ExecutionContext } from '@nestjs/common';
import { AuditInterceptor } from './audit.interceptor';
import { InMemoryAuditLog } from './in-memory-audit-log.service';

class FakeController {}

function makeContext(request: Record<string, unknown>, handlerName = 'start'): ExecutionContext {
  return {
    switchToHttp: () => ({ getRequest: () => request }),
    getClass: () => FakeController,
    getHandler: () => ({ name: handlerName }),
  } as unknown as ExecutionContext;
}

function makeHandler(result: unknown): CallHandler {
  return { handle: () => of(result) };
}

describe('AuditInterceptor', () => {
  let log: InMemoryAuditLog;
  let interceptor: AuditInterceptor;

  beforeEach(() => {
    log = new InMemoryAuditLog();
    interceptor = new AuditInterceptor(log);
  });

  it('records an event after the handler succeeds, derived from the request', (done) => {
    const request = { method: 'POST', body: { userId: 'user-demo' }, query: {}, params: { shiftId: 's1' } };
    const context = makeContext(request, 'start');

    interceptor.intercept(context, makeHandler({ shift: { id: 's1' } })).subscribe(() => {
      const [entry] = log.listEvents();
      expect(entry.actor).toBe('user-demo');
      expect(entry.entityType).toBe('fake');
      expect(entry.entityId).toBe('s1');
      expect(entry.action).toBe('POST start');
      expect(entry.payload).toEqual({ shift: { id: 's1' } });
      done();
    });
  });

  it('falls back to query userId when body has none', (done) => {
    const request = { method: 'POST', body: {}, query: { userId: 'from-query' }, params: { shiftId: 's1' } };
    interceptor.intercept(makeContext(request), makeHandler({})).subscribe(() => {
      expect(log.listEvents()[0].actor).toBe('from-query');
      done();
    });
  });

  it('falls back to "unknown" actor when neither body nor query has a userId', (done) => {
    const request = { method: 'POST', body: {}, query: {}, params: { shiftId: 's1' } };
    interceptor.intercept(makeContext(request), makeHandler({})).subscribe(() => {
      expect(log.listEvents()[0].actor).toBe('unknown');
      done();
    });
  });

  it('records a null entityId when the route has no params', (done) => {
    const request = { method: 'GET', body: {}, query: {}, params: {} };
    interceptor.intercept(makeContext(request), makeHandler({})).subscribe(() => {
      expect(log.listEvents()[0].entityId).toBeNull();
      done();
    });
  });

  it('does not record anything when the handler errors', (done) => {
    const request = { method: 'POST', body: {}, query: {}, params: { shiftId: 's1' } };
    const context = makeContext(request);
    const handler: CallHandler = {
      handle: () =>
        new Observable((subscriber) => {
          subscriber.error(new Error('boom'));
        }),
    };

    interceptor.intercept(context, handler).subscribe({
      error: () => {
        expect(log.listEvents()).toHaveLength(0);
        done();
      },
    });
  });
});
