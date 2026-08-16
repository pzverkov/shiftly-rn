import type { Break, Shift } from './shift.types';

// DI token: swap the backing store by rebinding this in ShiftsModule.
export abstract class ShiftsRepository {
  abstract saveShift(shift: Shift): Shift;
  abstract getShift(shiftId: string): Shift | null;
  abstract listShiftsForUser(userId: string): Shift[];
  abstract addBreak(brk: Break): Break;
  abstract saveBreak(brk: Break): Break;
  abstract listBreaks(shiftId: string): Break[];
  abstract getActiveBreak(shiftId: string): Break | null;
}
