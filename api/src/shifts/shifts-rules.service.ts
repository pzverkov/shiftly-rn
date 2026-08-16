import { Injectable } from '@nestjs/common';
import type { Break, Shift } from './shift.types';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const pure = require('./shifts-rules.pure') as {
  assertCanStartShift: (shift: Shift, now: Date, location: unknown) => void;
  assertCanFinishShift: (shift: Shift, now: Date, location: unknown) => void;
  assertCanStartBreak: (shift: Shift, breaks: Break[], activeBreak: Break | null, now: Date) => void;
  assertCanEndBreak: (activeBreak: Break | null, now: Date) => void;
};

@Injectable()
export class ShiftsRulesService {
  assertCanStartShift = pure.assertCanStartShift;
  assertCanFinishShift = pure.assertCanFinishShift;
  assertCanStartBreak = pure.assertCanStartBreak;
  assertCanEndBreak = pure.assertCanEndBreak;
}
