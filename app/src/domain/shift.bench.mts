import { Bench } from 'tinybench';

import { findActiveShift, getShiftState } from './shift.ts';
import { makeShift } from './testFixtures.ts';

/**
 * A sanity check, not a performance investigation.
 *
 * `getShiftState` runs once per shift per tick, and `findActiveShift` once per
 * tick over the whole list, so both sit on the 1Hz path while a countdown runs.
 * The honest expectation is that they are far too cheap to matter - this exists
 * to prove that rather than assume it, and to catch the day someone puts
 * something expensive behind that call.
 *
 * The real render cost is guarded in ShiftList.test.tsx, which asserts the tick
 * does not re-render the whole list. That is the number that actually moves a
 * battery meter; this one is arithmetic.
 *
 * Run with: npm run bench
 */

const now = new Date('2026-07-16T13:44:00.000Z').getTime();

const shift = makeShift({ startDate: '2026-07-16T14:00:00.000Z' });

// A generous rota. The API returns 1-4.
const many = Array.from({ length: 50 }, (_, index) =>
  makeShift({
    id: `shift-${index}`,
    startDate: new Date(now + index * 24 * 3_600_000).toISOString(),
  }),
);

const bench = new Bench({ time: 500 });

bench
  .add('getShiftState', () => {
    getShiftState(shift, now);
  })
  .add('findActiveShift over 50 shifts', () => {
    findActiveShift(many, now);
  });

await bench.run();

console.table(
  bench.tasks.map(({ name, result }) => {
    // `result` also covers the aborted case, which carries no timings.
    if (!result || !('throughput' in result)) return { name, 'ops/sec': 'n/a', 'ms/op': 'n/a' };

    return {
      name,
      'ops/sec': result.throughput.mean.toFixed(0),
      'ms/op': result.latency.mean.toFixed(5),
    };
  }),
);
