import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import * as express from 'express';
import { AppModule } from './../src/app.module';
import { TransformInterceptor } from './../src/common/interceptors/transform.interceptor';
import { HttpExceptionFilter } from './../src/common/filters/http-exception.filter';
import { transformKeysToCamelCase } from './../src/common/middleware/snake-case.middleware';

describe('Phase 4 — Bookings & Rule Engine (e2e)', () => {
  let app: INestApplication;
  let frankToken: string; // admin
  let graceToken: string; // member
  let heidiToken: string; // member
  let groupId: string;
  let resourceId: string;
  let graceBookingId1: string;
  let graceBookingId2: string;

  const getTomorrowDateStr = () => {
    const d = new Date();
    d.setUTCDate(d.getUTCDate() + 1);
    return d.toISOString().split('T')[0];
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api/v1');

    app.use(express.json());
    app.use((req: any, res: any, next: any) => {
      if (req.body && typeof req.body === 'object') {
        req.body = transformKeysToCamelCase(req.body);
      }
      if (req.query && typeof req.query === 'object') {
        const transformedQuery = transformKeysToCamelCase(req.query);
        for (const key of Object.keys(req.query)) {
          delete req.query[key];
        }
        Object.assign(req.query, transformedQuery);
      }
      next();
    });

    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        transform: true,
        forbidNonWhitelisted: true,
      }),
    );
    app.useGlobalInterceptors(new TransformInterceptor());
    app.useGlobalFilters(new HttpExceptionFilter());

    await app.init();

    // Register Frank (Admin)
    const frankReg = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({ display_name: 'Frank' });
    frankToken = frankReg.body.data.auth_token;

    // Register Grace (Member)
    const graceReg = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({ display_name: 'Grace' });
    graceToken = graceReg.body.data.auth_token;

    // Frank creates group
    const groupRes = await request(app.getHttpServer())
      .post('/api/v1/groups')
      .set('Authorization', `Bearer ${frankToken}`)
      .send({ name: "Frank's Apartment" });
    groupId = groupRes.body.data.id;
    const inviteCode = groupRes.body.data.invite_code;

    // Grace joins group
    await request(app.getHttpServer())
      .post('/api/v1/groups/join')
      .set('Authorization', `Bearer ${graceToken}`)
      .send({ invite_code: inviteCode });

    // Register Heidi (Member)
    const heidiReg = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({ display_name: 'Heidi' });
    heidiToken = heidiReg.body.data.auth_token;

    // Heidi joins group
    await request(app.getHttpServer())
      .post('/api/v1/groups/join')
      .set('Authorization', `Bearer ${heidiToken}`)
      .send({ invite_code: inviteCode });

    // Frank creates resource
    const resRes = await request(app.getHttpServer())
      .post(`/api/v1/groups/${groupId}/resources`)
      .set('Authorization', `Bearer ${frankToken}`)
      .send({
        name: 'Shared Laundry',
        capacity: 1,
        slot_duration_minutes: 60,
      });
    resourceId = resRes.body.data.id;

    // Frank sets booking rules
    await request(app.getHttpServer())
      .put(`/api/v1/groups/${groupId}/resources/${resourceId}/rules`)
      .set('Authorization', `Bearer ${frankToken}`)
      .send([
        {
          day_scope: 'WEEKDAY',
          max_bookings_per_day: 2,
          available_from: '08:00',
          available_until: '22:00',
          cooldown_minutes: 60,
        },
        {
          day_scope: 'WEEKEND',
          max_bookings_per_day: 2,
          available_from: '08:00',
          available_until: '22:00',
          cooldown_minutes: 60,
        },
      ]);
  });

  afterAll(async () => {
    await app.close();
  });

  it('POST .../bookings - Grace books tomorrow 09:00-10:00', async () => {
    const dateStr = getTomorrowDateStr();
    const res = await request(app.getHttpServer())
      .post(`/api/v1/groups/${groupId}/resources/${resourceId}/bookings`)
      .set('Authorization', `Bearer ${graceToken}`)
      .send({
        start_time: `${dateStr}T09:00:00Z`,
        end_time: `${dateStr}T10:00:00Z`,
      })
      .expect(201);

    expect(res.body.data).toHaveProperty('id');
    expect(res.body.data.status).toBe('CONFIRMED');
    graceBookingId1 = res.body.data.id;
  });

  it('POST .../bookings - Frank attempts same slot -> 409 slot_full', async () => {
    const dateStr = getTomorrowDateStr();
    const res = await request(app.getHttpServer())
      .post(`/api/v1/groups/${groupId}/resources/${resourceId}/bookings`)
      .set('Authorization', `Bearer ${frankToken}`)
      .send({
        start_time: `${dateStr}T09:00:00Z`,
        end_time: `${dateStr}T10:00:00Z`,
      })
      .expect(409);

    expect(res.body.error.message).toBe('slot_full');
  });

  it('POST .../bookings - Grace attempts 10:00-11:00 -> 400 cooldown violation', async () => {
    const dateStr = getTomorrowDateStr();
    const res = await request(app.getHttpServer())
      .post(`/api/v1/groups/${groupId}/resources/${resourceId}/bookings`)
      .set('Authorization', `Bearer ${graceToken}`)
      .send({
        start_time: `${dateStr}T10:00:00Z`,
        end_time: `${dateStr}T11:00:00Z`,
      })
      .expect(400);

    expect(res.body.error.message).toBe('booking_rule_violation');
    expect(res.body.error.details[0]).toContain('cooldown');
  });

  it('POST .../bookings - Grace books 11:00-12:00 (after cooldown)', async () => {
    const dateStr = getTomorrowDateStr();
    const res = await request(app.getHttpServer())
      .post(`/api/v1/groups/${groupId}/resources/${resourceId}/bookings`)
      .set('Authorization', `Bearer ${graceToken}`)
      .send({
        start_time: `${dateStr}T11:00:00Z`,
        end_time: `${dateStr}T12:00:00Z`,
      })
      .expect(201);

    expect(res.body.data.status).toBe('CONFIRMED');
    graceBookingId2 = res.body.data.id;
  });

  it('POST .../bookings - Grace attempts 3rd booking -> 400 max_bookings_per_day', async () => {
    const dateStr = getTomorrowDateStr();
    const res = await request(app.getHttpServer())
      .post(`/api/v1/groups/${groupId}/resources/${resourceId}/bookings`)
      .set('Authorization', `Bearer ${graceToken}`)
      .send({
        start_time: `${dateStr}T13:00:00Z`,
        end_time: `${dateStr}T14:00:00Z`,
      })
      .expect(400);

    expect(res.body.error.details[0]).toContain('max_bookings_per_day');
  });

  it('GET .../availability - check slot statuses for Grace', async () => {
    const dateStr = getTomorrowDateStr();
    const res = await request(app.getHttpServer())
      .get(
        `/api/v1/groups/${groupId}/resources/${resourceId}/availability?date=${dateStr}`,
      )
      .set('Authorization', `Bearer ${graceToken}`)
      .expect(200);

    expect(res.body.data).toHaveProperty('slots');
    expect(res.body.data.user_stats.bookings_today).toBe(2);

    const slot09 = res.body.data.slots.find((s: any) =>
      s.start_time.includes('T09:00:00'),
    );
    const slot10 = res.body.data.slots.find((s: any) =>
      s.start_time.includes('T10:00:00'),
    );
    expect(slot09.status).toBe('full');
    expect(slot10.status).toBe('cooldown');
  });

  it('GET .../my_bookings - Grace lists her bookings', async () => {
    const dateStr = getTomorrowDateStr();
    const res = await request(app.getHttpServer())
      .get(
        `/api/v1/groups/${groupId}/my_bookings?from=${dateStr}&to=${dateStr}`,
      )
      .set('Authorization', `Bearer ${graceToken}`)
      .expect(200);

    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data.length).toBe(2);
  });

  it('DELETE .../bookings/:id - Grace cancels her first booking', async () => {
    await request(app.getHttpServer())
      .delete(`/api/v1/groups/${groupId}/bookings/${graceBookingId1}`)
      .set('Authorization', `Bearer ${graceToken}`)
      .expect(204);
  });

  it('POST .../bookings - Frank books freed slot 09:00-10:00', async () => {
    const dateStr = getTomorrowDateStr();
    const res = await request(app.getHttpServer())
      .post(`/api/v1/groups/${groupId}/resources/${resourceId}/bookings`)
      .set('Authorization', `Bearer ${frankToken}`)
      .send({
        start_time: `${dateStr}T09:00:00Z`,
        end_time: `${dateStr}T10:00:00Z`,
      })
      .expect(201);

    expect(res.body.data.status).toBe('CONFIRMED');
  });

  it('PATCH .../bookings/:id - Heidi cannot reschedule Grace booking -> 403', async () => {
    const dateStr = getTomorrowDateStr();
    await request(app.getHttpServer())
      .patch(`/api/v1/groups/${groupId}/bookings/${graceBookingId2}`)
      .set('Authorization', `Bearer ${heidiToken}`)
      .send({
        start_time: `${dateStr}T14:00:00Z`,
        end_time: `${dateStr}T15:00:00Z`,
      })
      .expect(403);
  });

  it('PATCH .../bookings/:id - Cannot reschedule cancelled booking -> 400', async () => {
    const dateStr = getTomorrowDateStr();
    const res = await request(app.getHttpServer())
      .patch(`/api/v1/groups/${groupId}/bookings/${graceBookingId1}`)
      .set('Authorization', `Bearer ${graceToken}`)
      .send({
        start_time: `${dateStr}T14:00:00Z`,
        end_time: `${dateStr}T15:00:00Z`,
      })
      .expect(400);

    expect(res.body.error.message).toContain('cannot_reschedule_cancelled_booking');
  });

  it('PATCH .../bookings/:id - Conflict with Frank booking -> 409 slot_full', async () => {
    const dateStr = getTomorrowDateStr();
    const res = await request(app.getHttpServer())
      .patch(`/api/v1/groups/${groupId}/bookings/${graceBookingId2}`)
      .set('Authorization', `Bearer ${graceToken}`)
      .send({
        start_time: `${dateStr}T09:00:00Z`,
        end_time: `${dateStr}T10:00:00Z`,
      })
      .expect(409);

    expect(res.body.error.message).toBe('slot_full');
  });

  it('PATCH .../bookings/:id - Grace reschedules booking to 14:00-15:00 -> 200', async () => {
    const dateStr = getTomorrowDateStr();
    const res = await request(app.getHttpServer())
      .patch(`/api/v1/groups/${groupId}/bookings/${graceBookingId2}`)
      .set('Authorization', `Bearer ${graceToken}`)
      .send({
        start_time: `${dateStr}T14:00:00Z`,
        end_time: `${dateStr}T15:00:00Z`,
      })
      .expect(200);

    expect(res.body.data.id).toBe(graceBookingId2);
    expect(res.body.data.start_time).toBe(`${dateStr}T14:00:00.000Z`);
    expect(res.body.data.end_time).toBe(`${dateStr}T15:00:00.000Z`);
    expect(res.body.data.status).toBe('CONFIRMED');
  });

  it('PATCH .../bookings/:id - Admin Frank can reschedule Grace booking -> 200', async () => {
    const dateStr = getTomorrowDateStr();
    const res = await request(app.getHttpServer())
      .patch(`/api/v1/groups/${groupId}/bookings/${graceBookingId2}`)
      .set('Authorization', `Bearer ${frankToken}`)
      .send({
        start_time: `${dateStr}T15:00:00Z`,
        end_time: `${dateStr}T16:00:00Z`,
      })
      .expect(200);

    expect(res.body.data.id).toBe(graceBookingId2);
    expect(res.body.data.start_time).toBe(`${dateStr}T15:00:00.000Z`);
    expect(res.body.data.end_time).toBe(`${dateStr}T16:00:00.000Z`);
  });
});
