import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import type { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { AuditLog } from './audit-log';

// Records on success only - an error short-circuits the pipe before tap() runs.
// Apply per-handler via @UseInterceptors on mutating routes; skip read-only ones.
@Injectable()
export class AuditInterceptor implements NestInterceptor {
  constructor(private readonly auditLog: AuditLog) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest();
    const body = (request.body ?? {}) as Record<string, unknown>;
    const query = (request.query ?? {}) as Record<string, unknown>;
    const params = (request.params ?? {}) as Record<string, unknown>;

    const actor = (body.userId as string) || (query.userId as string) || 'unknown';
    const entityType = context.getClass().name.replace(/Controller$/, '').toLowerCase();
    const entityId = (Object.values(params)[0] as string | undefined) ?? null;
    const action = `${request.method} ${context.getHandler().name}`;

    return next.handle().pipe(
      tap((result) => {
        this.auditLog.record({ actor, action, entityType, entityId, payload: result });
      }),
    );
  }
}
