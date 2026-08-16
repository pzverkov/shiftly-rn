import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { ApiErrorFilter } from '../src/common/api-error.filter';
import { createValidationPipe } from '../src/common/validation.pipe';
import { ShiftsFixturesProvider } from '../src/shifts/shifts-fixtures.provider';
import { AuditLog } from '../src/audit/audit-log';

describe('Shifts API (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.useGlobalFilters(new ApiErrorFilter());
    app.useGlobalPipes(createValidationPipe());
    await app.init();
    app.get(ShiftsFixturesProvider).generateFixtures(new Date('2026-07-16T10:00:00.000Z'));
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /shifts/list returns the seeded Kitsune de Madrid-or-other-brand shifts', async () => {
    const res = await request(app.getHttpServer()).get('/shifts/list?userId=user-demo');
    expect(res.status).toBe(200);
    expect(res.body.shifts.length).toBeGreaterThanOrEqual(1);
  });

  it('POST /shifts/:id/start rejects a shift more than 50m from the branch', async () => {
    const list = await request(app.getHttpServer()).get('/shifts/list?userId=user-demo');
    const shiftId = list.body.shifts[0].id;

    const res = await request(app.getHttpServer())
      .post(`/shifts/${shiftId}/start`)
      .send({ datetime: '2026-07-16T10:10:00.000Z', location: { lat: 0, lng: 0 } });

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('SHIFT_OUT_OF_RANGE');
  });

  it('POST /shifts/:id/start on an unknown id returns SHIFT_NOT_FOUND with 404', async () => {
    const res = await request(app.getHttpServer())
      .post('/shifts/does-not-exist/start')
      .send({ location: { lat: 40.4262, lng: -3.7038 } });

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('SHIFT_NOT_FOUND');
  });

  it('POST /shifts/:id/start clocks in on a valid attempt and records a verifiable audit entry', async () => {
    const list = await request(app.getHttpServer()).get('/shifts/list?userId=user-demo');
    const shift = list.body.shifts[0];

    const res = await request(app.getHttpServer())
      .post(`/shifts/${shift.id}/start`)
      .send({ datetime: '2026-07-16T10:10:00.000Z', location: shift.branch.location, userId: 'user-demo' });

    expect(res.status).toBe(201);
    expect(res.body.shift.startedAt).toBe('2026-07-16T10:10:00.000Z');

    const auditLog = app.get(AuditLog);
    const events = auditLog.listEvents({ entityId: shift.id });
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ actor: 'user-demo', entityType: 'shifts', entityId: shift.id });
    expect(auditLog.verify()).toEqual({ valid: true, brokenAtId: null });
  });

  it('POST /shifts/:id/start rejects a malformed body via the real validation pipe', async () => {
    const list = await request(app.getHttpServer()).get('/shifts/list?userId=user-demo');
    const shiftId = list.body.shifts[0].id;

    const res = await request(app.getHttpServer())
      .post(`/shifts/${shiftId}/start`)
      .send({ datetime: 'not-a-date', location: { lat: 200, lng: -3.7038 } });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(res.body.error.details.fields).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ field: 'datetime' }),
        expect.objectContaining({ field: 'lat' }),
      ]),
    );
  });

  it('POST /shifts/:id/break strips unknown body fields rather than rejecting them', async () => {
    // Reuses the shift the earlier "clocks in" test already started - real wall-clock
    // time (datetime omitted) is trivially past the 2-minute post-start gate.
    const list = await request(app.getHttpServer()).get('/shifts/list?userId=user-demo');
    const shift = list.body.shifts[0];

    const res = await request(app.getHttpServer())
      .post(`/shifts/${shift.id}/break`)
      .send({ userId: 'user-demo', notAField: 'ignored' });

    expect(res.status).toBe(201);
  });

  it('GET /health reports ok', async () => {
    const res = await request(app.getHttpServer()).get('/health');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true });
  });
});
