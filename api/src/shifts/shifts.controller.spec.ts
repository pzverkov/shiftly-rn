import { Test } from '@nestjs/testing';
import { ShiftsController } from './shifts.controller';
import { ShiftsStoreService } from './shifts-store.service';
import { ShiftsRepository } from './shifts.repository';
import { ShiftsRulesService } from './shifts-rules.service';
import { ShiftsFixturesProvider } from './shifts-fixtures.provider';
import { HERE, makeShift } from '../testing/shift-fixtures';
import { AuditModule } from '../audit/audit.module';

describe('ShiftsController', () => {
  let controller: ShiftsController;
  let store: ShiftsRepository;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      imports: [AuditModule],
      controllers: [ShiftsController],
      providers: [
        { provide: ShiftsRepository, useClass: ShiftsStoreService },
        ShiftsRulesService,
        ShiftsFixturesProvider,
      ],
    }).compile();

    controller = module.get(ShiftsController);
    store = module.get(ShiftsRepository);
  });

  it('lists shifts for the resolved user, defaulting to user-demo', () => {
    store.saveShift(makeShift());
    expect(controller.list({})).toEqual({ shifts: [makeShift()] });
  });

  it('starts a shift inside the window and at the branch', () => {
    store.saveShift(makeShift());
    const result = controller.start(
      'shift-1',
      { datetime: '2026-07-16T13:50:00.000Z', location: HERE },
      {},
    );
    expect(result.shift.startedAt).toBe('2026-07-16T13:50:00.000Z');
    expect(result.shift.startedAtLocation).toEqual(HERE);
  });

  it('throws SHIFT_NOT_FOUND for an unknown shift id', () => {
    expect(() => controller.start('nope', { location: HERE }, {})).toThrow(
      expect.objectContaining({ code: 'SHIFT_NOT_FOUND' }),
    );
  });

  it('throws SHIFT_NOT_FOUND when the shift belongs to a different user (body userId)', () => {
    store.saveShift(makeShift());
    expect(() => controller.start('shift-1', { location: HERE, userId: 'someone-else' }, {})).toThrow(
      expect.objectContaining({ code: 'SHIFT_NOT_FOUND' }),
    );
  });

  it('throws SHIFT_NOT_FOUND when the shift belongs to a different user (query userId)', () => {
    store.saveShift(makeShift());
    expect(() => controller.start('shift-1', { location: HERE }, { userId: 'someone-else' })).toThrow(
      expect.objectContaining({ code: 'SHIFT_NOT_FOUND' }),
    );
  });

  it('throws SHIFT_NOT_FOUND from listBreaks when the shift belongs to a different user', () => {
    store.saveShift(makeShift());
    expect(() => controller.listBreaks('shift-1', { userId: 'someone-else' })).toThrow(
      expect.objectContaining({ code: 'SHIFT_NOT_FOUND' }),
    );
  });

  it('finishes a started shift and closes any open break with the same datetime', () => {
    store.saveShift(makeShift({ startedAt: '2026-07-16T14:00:00.000Z' }));
    store.addBreak({ id: 'b1', shiftId: 'shift-1', startedAt: '2026-07-16T16:00:00.000Z', endedAt: null });

    const result = controller.finish(
      'shift-1',
      { datetime: '2026-07-16T20:00:00.000Z', location: HERE },
      {},
    );

    expect(result.shift.finishedAt).toBe('2026-07-16T20:00:00.000Z');
    expect(store.getActiveBreak('shift-1')).toBeNull();
  });

  it('starts and ends a break through the full round trip', () => {
    store.saveShift(makeShift({ startedAt: '2026-07-16T14:00:00.000Z' }));

    const started = controller.startBreak('shift-1', { datetime: '2026-07-16T14:05:00.000Z' }, {});
    expect(started.break.endedAt).toBeNull();

    const ended = controller.endBreak('shift-1', { datetime: '2026-07-16T14:10:00.000Z' }, {});
    expect(ended.break.endedAt).toBe('2026-07-16T14:10:00.000Z');

    expect(controller.listBreaks('shift-1', {}).breaks).toHaveLength(1);
  });
});
