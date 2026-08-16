import { Module } from '@nestjs/common';
import { AuditLog } from './audit-log';
import { InMemoryAuditLog } from './in-memory-audit-log.service';
import { AuditInterceptor } from './audit.interceptor';

@Module({
  providers: [{ provide: AuditLog, useClass: InMemoryAuditLog }, AuditInterceptor],
  exports: [AuditLog, AuditInterceptor],
})
export class AuditModule {}
