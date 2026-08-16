import { randomUUID } from 'node:crypto';
import { Body, Controller, Get, Param, Post, Query, UseInterceptors } from '@nestjs/common';
import { ShiftsRepository } from './shifts.repository';
import { ShiftsRulesService } from './shifts-rules.service';
import { ShiftsFixturesProvider } from './shifts-fixtures.provider';
import { resolveUserId, toDate, toGeoPoint } from './shifts-request.utils';
import { ShiftActionDto } from './shifts-action.dto';
import { ERRORS } from '../common/api-error.pure';
import type { Break, Shift } from './shift.types';
import { AuditInterceptor } from '../audit/audit.interceptor';

@Controller('shifts')
export class ShiftsController {
  constructor(
    private readonly store: ShiftsRepository,
    private readonly rules: ShiftsRulesService,
    private readonly fixtures: ShiftsFixturesProvider,
  ) {}

  private loadShift(shiftId: string, body: unknown, query: unknown): Shift {
    const userId = resolveUserId(body, query, this.fixtures.DEFAULT_USER_ID);
    const shift = this.store.getShift(shiftId);
    if (!shift || shift.userId !== userId) throw ERRORS.SHIFT_NOT_FOUND(shiftId);
    return shift;
  }

  @Get('list')
  list(@Query() query: unknown): { shifts: Shift[] } {
    const userId = resolveUserId(undefined, query, this.fixtures.DEFAULT_USER_ID);
    return { shifts: this.store.listShiftsForUser(userId) };
  }

  @Post(':shiftId/start')
  @UseInterceptors(AuditInterceptor)
  start(
    @Param('shiftId') shiftId: string,
    @Body() body: ShiftActionDto,
    @Query() query: unknown,
  ): { shift: Shift } {
    const shift = this.loadShift(shiftId, body, query);
    const now = toDate(body?.datetime);
    const location = toGeoPoint(body?.location);

    this.rules.assertCanStartShift(shift, now, location);

    shift.startedAt = now.toISOString();
    shift.startedAtLocation = location;
    this.store.saveShift(shift);
    return { shift };
  }

  @Post(':shiftId/finish')
  @UseInterceptors(AuditInterceptor)
  finish(
    @Param('shiftId') shiftId: string,
    @Body() body: ShiftActionDto,
    @Query() query: unknown,
  ): { shift: Shift } {
    const shift = this.loadShift(shiftId, body, query);
    const now = toDate(body?.datetime);
    const location = toGeoPoint(body?.location);

    this.rules.assertCanFinishShift(shift, now, location);

    const active = this.store.getActiveBreak(shift.id);
    if (active) {
      active.endedAt = now.toISOString();
      this.store.saveBreak(active);
    }

    shift.finishedAt = now.toISOString();
    shift.finishedAtLocation = location;
    this.store.saveShift(shift);
    return { shift };
  }

  @Post(':shiftId/break')
  @UseInterceptors(AuditInterceptor)
  startBreak(
    @Param('shiftId') shiftId: string,
    @Body() body: ShiftActionDto,
    @Query() query: unknown,
  ): { break: Break } {
    const shift = this.loadShift(shiftId, body, query);
    const now = toDate(body?.datetime);
    const breaks = this.store.listBreaks(shift.id);
    const active = this.store.getActiveBreak(shift.id);

    this.rules.assertCanStartBreak(shift, breaks, active, now);

    const brk: Break = { id: randomUUID(), shiftId: shift.id, startedAt: now.toISOString(), endedAt: null };
    this.store.addBreak(brk);
    return { break: brk };
  }

  @Post(':shiftId/break/end')
  @UseInterceptors(AuditInterceptor)
  endBreak(
    @Param('shiftId') shiftId: string,
    @Body() body: ShiftActionDto,
    @Query() query: unknown,
  ): { break: Break } {
    const shift = this.loadShift(shiftId, body, query);
    const now = toDate(body?.datetime);
    const active = this.store.getActiveBreak(shift.id);

    this.rules.assertCanEndBreak(active, now);

    active!.endedAt = now.toISOString();
    this.store.saveBreak(active!);
    return { break: active! };
  }

  @Get(':shiftId/break/list')
  listBreaks(@Param('shiftId') shiftId: string, @Query() query: unknown): { breaks: Break[] } {
    const shift = this.loadShift(shiftId, undefined, query);
    return { breaks: this.store.listBreaks(shift.id) };
  }
}
