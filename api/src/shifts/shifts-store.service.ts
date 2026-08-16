import { Injectable } from '@nestjs/common';
import type { Break, Shift } from './shift.types';
import { ShiftsRepository } from './shifts.repository';

@Injectable()
export class ShiftsStoreService extends ShiftsRepository {
  private readonly shifts = new Map<string, Shift>();
  private readonly breaks = new Map<string, Break[]>();

  saveShift(shift: Shift): Shift {
    this.shifts.set(shift.id, shift);
    return shift;
  }

  getShift(shiftId: string): Shift | null {
    return this.shifts.get(shiftId) ?? null;
  }

  listShiftsForUser(userId: string): Shift[] {
    return [...this.shifts.values()]
      .filter((shift) => shift.userId === userId)
      .sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime());
  }

  addBreak(brk: Break): Break {
    const list = this.breaks.get(brk.shiftId) ?? [];
    list.push(brk);
    this.breaks.set(brk.shiftId, list);
    return brk;
  }

  saveBreak(brk: Break): Break {
    const list = this.breaks.get(brk.shiftId) ?? [];
    const index = list.findIndex((b) => b.id === brk.id);
    if (index >= 0) list[index] = brk;
    return brk;
  }

  listBreaks(shiftId: string): Break[] {
    return [...(this.breaks.get(shiftId) ?? [])].sort(
      (a, b) => new Date(a.startedAt).getTime() - new Date(b.startedAt).getTime(),
    );
  }

  getActiveBreak(shiftId: string): Break | null {
    return this.listBreaks(shiftId).find((b) => b.endedAt == null) ?? null;
  }
}
