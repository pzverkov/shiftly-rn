const { assertCanStartShift, assertCanFinishShift, assertCanStartBreak, assertCanEndBreak } =
  require('./shifts-rules.pure');
const { HERE, makeShift } = require('../testing/shift-fixtures');

const FAR_AWAY = { lat: 40.6, lng: -3.9 }; // ~25km from BRANCH, well outside the 50m geofence

describe('assertCanStartShift', () => {
  it('allows starting inside the 15-minute window, on time, on location', () => {
    const shift = makeShift();
    const now = new Date('2026-07-16T13:50:00.000Z'); // 10 min before start
    expect(() => assertCanStartShift(shift, now, HERE)).not.toThrow();
  });

  it('rejects more than 15 minutes early with SHIFT_START_TOO_EARLY', () => {
    const shift = makeShift();
    const now = new Date('2026-07-16T13:30:00.000Z'); // 30 min before start
    expect(() => assertCanStartShift(shift, now, HERE)).toThrow(
      expect.objectContaining({ code: 'SHIFT_START_TOO_EARLY' }),
    );
  });

  it('rejects a shift already started', () => {
    const shift = makeShift({ startedAt: '2026-07-16T13:50:00.000Z' });
    expect(() => assertCanStartShift(shift, new Date('2026-07-16T13:55:00.000Z'), HERE)).toThrow(
      expect.objectContaining({ code: 'SHIFT_ALREADY_STARTED' }),
    );
  });

  it('rejects starting on a different calendar day with SHIFT_WRONG_DAY', () => {
    const shift = makeShift();
    const now = new Date('2026-07-15T13:50:00.000Z');
    expect(() => assertCanStartShift(shift, now, HERE)).toThrow(
      expect.objectContaining({ code: 'SHIFT_WRONG_DAY' }),
    );
  });

  it('rejects a location more than 50m from the branch with SHIFT_OUT_OF_RANGE', () => {
    const shift = makeShift();
    const now = new Date('2026-07-16T13:50:00.000Z');
    expect(() => assertCanStartShift(shift, now, FAR_AWAY)).toThrow(
      expect.objectContaining({ code: 'SHIFT_OUT_OF_RANGE' }),
    );
  });

  it('requires a location at all', () => {
    const shift = makeShift();
    const now = new Date('2026-07-16T13:50:00.000Z');
    expect(() => assertCanStartShift(shift, now, null)).toThrow(
      expect.objectContaining({ code: 'VALIDATION_ERROR' }),
    );
  });
});

describe('assertCanFinishShift', () => {
  it('allows finishing a started shift within the 30-minute grace period', () => {
    const shift = makeShift({ startedAt: '2026-07-16T14:00:00.000Z' });
    const now = new Date('2026-07-16T22:20:00.000Z'); // 20 min after endDate
    expect(() => assertCanFinishShift(shift, now, HERE)).not.toThrow();
  });

  it('rejects finishing more than 30 minutes late with SHIFT_FINISH_TOO_LATE', () => {
    const shift = makeShift({ startedAt: '2026-07-16T14:00:00.000Z' });
    const now = new Date('2026-07-16T23:00:00.000Z'); // 40 min after endDate
    expect(() => assertCanFinishShift(shift, now, HERE)).toThrow(
      expect.objectContaining({ code: 'SHIFT_FINISH_TOO_LATE' }),
    );
  });

  it('rejects finishing a shift that never started', () => {
    const shift = makeShift();
    expect(() => assertCanFinishShift(shift, new Date(), HERE)).toThrow(
      expect.objectContaining({ code: 'SHIFT_NOT_STARTED' }),
    );
  });
});

describe('assertCanStartBreak / assertCanEndBreak', () => {
  const started = makeShift({ startedAt: '2026-07-16T14:00:00.000Z' });

  it('rejects a break less than 2 minutes after clock-in', () => {
    const now = new Date('2026-07-16T14:01:00.000Z');
    expect(() => assertCanStartBreak(started, [], null, now)).toThrow(
      expect.objectContaining({ code: 'BREAK_TOO_SOON_AFTER_START' }),
    );
  });

  it('allows a break at exactly 2 minutes after clock-in', () => {
    const now = new Date('2026-07-16T14:02:00.000Z');
    expect(() => assertCanStartBreak(started, [], null, now)).not.toThrow();
  });

  it('rejects a third break with BREAK_LIMIT_REACHED', () => {
    const twoBreaks = [
      { id: 'b1', shiftId: started.id, startedAt: started.startedAt, endedAt: started.startedAt },
      { id: 'b2', shiftId: started.id, startedAt: started.startedAt, endedAt: started.startedAt },
    ];
    const now = new Date('2026-07-16T18:00:00.000Z');
    expect(() => assertCanStartBreak(started, twoBreaks, null, now)).toThrow(
      expect.objectContaining({ code: 'BREAK_LIMIT_REACHED' }),
    );
  });

  it('rejects ending a break before the 2-minute minimum duration', () => {
    const active = { id: 'b1', shiftId: started.id, startedAt: '2026-07-16T15:00:00.000Z', endedAt: null };
    const now = new Date('2026-07-16T15:01:00.000Z');
    expect(() => assertCanEndBreak(active, now)).toThrow(
      expect.objectContaining({ code: 'BREAK_END_TOO_SOON' }),
    );
  });

  it('rejects ending a break when none is active', () => {
    expect(() => assertCanEndBreak(null, new Date())).toThrow(
      expect.objectContaining({ code: 'BREAK_NOT_ACTIVE' }),
    );
  });
});
