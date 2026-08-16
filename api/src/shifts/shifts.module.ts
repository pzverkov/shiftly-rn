import { Module } from '@nestjs/common';
import { ShiftsController } from './shifts.controller';
import { ShiftsStoreService } from './shifts-store.service';
import { ShiftsRepository } from './shifts.repository';
import { ShiftsRulesService } from './shifts-rules.service';
import { ShiftsFixturesProvider } from './shifts-fixtures.provider';
import { AuditModule } from '../audit/audit.module';

@Module({
  imports: [AuditModule],
  controllers: [ShiftsController],
  providers: [
    { provide: ShiftsRepository, useClass: ShiftsStoreService },
    ShiftsRulesService,
    ShiftsFixturesProvider,
  ],
  exports: [ShiftsRepository, ShiftsFixturesProvider],
})
export class ShiftsModule {}
