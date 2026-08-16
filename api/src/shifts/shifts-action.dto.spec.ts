import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { ShiftActionDto } from './shifts-action.dto';

async function validateBody(plain: unknown) {
  const dto = plainToInstance(ShiftActionDto, plain);
  return validate(dto);
}

describe('ShiftActionDto', () => {
  it('accepts an empty body - every field is optional', async () => {
    expect(await validateBody({})).toHaveLength(0);
  });

  it('accepts a valid { lat, lng } location', async () => {
    expect(await validateBody({ location: { lat: 51.5, lng: -0.1 } })).toHaveLength(0);
  });

  it('accepts a valid ISO datetime', async () => {
    expect(await validateBody({ datetime: '2026-07-16T14:00:00.000Z' })).toHaveLength(0);
  });

  it('rejects a non-ISO datetime', async () => {
    const errors = await validateBody({ datetime: 'not-a-date' });
    expect(errors).not.toHaveLength(0);
    expect(errors[0].property).toBe('datetime');
  });

  it('rejects non-numeric lat/lng', async () => {
    const errors = await validateBody({ location: { lat: '51', lng: -0.1 } });
    expect(errors).not.toHaveLength(0);
  });

  it('rejects out-of-range coordinates', async () => {
    const errors = await validateBody({ location: { lat: 200, lng: -0.1 } });
    expect(errors).not.toHaveLength(0);
  });

  it('rejects a non-object location', async () => {
    const errors = await validateBody({ location: 'nope' });
    expect(errors).not.toHaveLength(0);
  });

  it('rejects a non-string userId', async () => {
    const errors = await validateBody({ userId: 123 });
    expect(errors).not.toHaveLength(0);
  });
});
