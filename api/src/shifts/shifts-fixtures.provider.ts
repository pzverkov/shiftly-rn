import { randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { ShiftsRepository } from './shifts.repository';
import type { Branch, Brand, Shift } from './shift.types';

type DemoBrand = Brand & { branches: Branch[] };

const BRANDS: DemoBrand[] = [
  {
    id: 'brand-kitsune-madrid',
    name: 'Kitsune de Madrid',
    branches: [
      { id: 'branch-malasana', name: 'Malasaña', location: { lat: 40.4262, lng: -3.7038 } },
      { id: 'branch-chueca', name: 'Chueca', location: { lat: 40.4230, lng: -3.6975 } },
      { id: 'branch-lavapies', name: 'Lavapiés', location: { lat: 40.4092, lng: -3.7010 } },
    ],
  },
  {
    id: 'brand-grulla-dorada',
    name: 'La Grulla Dorada',
    branches: [
      { id: 'branch-gracia', name: 'Gràcia', location: { lat: 41.4036, lng: 2.1527 } },
      { id: 'branch-eixample', name: 'Eixample', location: { lat: 41.3888, lng: 2.1590 } },
      { id: 'branch-el-born', name: 'El Born', location: { lat: 41.3850, lng: 2.1827 } },
    ],
  },
  {
    id: 'brand-tsuki-no-te',
    name: 'Tsuki no Té',
    branches: [
      { id: 'branch-ruzafa', name: 'Ruzafa', location: { lat: 39.4620, lng: -0.3763 } },
      { id: 'branch-santa-cruz', name: 'Santa Cruz', location: { lat: 37.3860, lng: -5.9890 } },
    ],
  },
];

function pick<T>(list: T[]): T {
  return list[Math.floor(Math.random() * list.length)];
}

function startOfDay(date: Date): Date {
  const copy = new Date(date);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

function addDays(date: Date, days: number): Date {
  const copy = new Date(date);
  copy.setDate(copy.getDate() + days);
  return copy;
}

@Injectable()
export class ShiftsFixturesProvider {
  readonly DEFAULT_USER_ID = 'user-demo';

  constructor(private readonly store: ShiftsRepository) {}

  private buildShift(userId: string, startDate: Date, endDate: Date): Shift {
    const brand = pick(BRANDS);
    const branch = pick(brand.branches);
    return {
      id: randomUUID(),
      userId,
      brand: { id: brand.id, name: brand.name },
      branch: { id: branch.id, name: branch.name, location: branch.location },
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
      startedAt: null,
      finishedAt: null,
      startedAtLocation: null,
      finishedAtLocation: null,
    };
  }

  // Generates 1-4 shifts: always one starting 16 minutes from `now` today, plus 0-3
  // more on distinct future days.
  generateFixtures(now: Date = new Date(), userId: string = this.DEFAULT_USER_ID): Shift[] {
    const shifts: Shift[] = [];

    const todayStart = new Date(now.getTime() + 16 * 60 * 1000);
    const todayEnd = new Date(todayStart.getTime() + 8 * 60 * 60 * 1000);
    shifts.push(this.buildShift(userId, todayStart, todayEnd));

    const extraCount = Math.floor(Math.random() * 4); // 0..3
    const today = startOfDay(now);
    for (let i = 0; i < extraCount; i++) {
      const day = addDays(today, i + 1);
      day.setHours(9 + Math.floor(Math.random() * 4), 0, 0, 0);
      const end = new Date(day.getTime() + 8 * 60 * 60 * 1000);
      shifts.push(this.buildShift(userId, day, end));
    }

    shifts.forEach((shift) => this.store.saveShift(shift));
    return shifts;
  }
}
