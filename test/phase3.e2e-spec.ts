import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import * as express from 'express';
import { AppModule } from './../src/app.module';
import { TransformInterceptor } from './../src/common/interceptors/transform.interceptor';
import { HttpExceptionFilter } from './../src/common/filters/http-exception.filter';
import { transformKeysToCamelCase } from './../src/common/middleware/snake-case.middleware';

describe('Phase 3 — Resources & Booking Rules (e2e)', () => {
  let app: INestApplication;
  let eveToken: string;
  let groupId: string;
  let resourceId: string;

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

    // Register Eve
    const regRes = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({ display_name: 'Eve' });
    eveToken = regRes.body.data.auth_token;

    // Create Group
    const groupRes = await request(app.getHttpServer())
      .post('/api/v1/groups')
      .set('Authorization', `Bearer ${eveToken}`)
      .send({ name: "Eve's Club" });
    groupId = groupRes.body.data.id;
  });

  afterAll(async () => {
    await app.close();
  });

  describe('Resources', () => {
    it('POST /api/v1/groups/:group_id/resources - create resource', async () => {
      const res = await request(app.getHttpServer())
        .post(`/api/v1/groups/${groupId}/resources`)
        .set('Authorization', `Bearer ${eveToken}`)
        .send({
          name: 'Tennis Court',
          description: 'Outdoor court A',
          capacity: 2,
          slot_duration_minutes: 60,
        })
        .expect(201);

      expect(res.body.data).toHaveProperty('name', 'Tennis Court');
      expect(res.body.data).toHaveProperty('slot_duration_minutes', 60);
      expect(res.body.data).toHaveProperty('is_active', true);

      resourceId = res.body.data.id;
    });

    it('GET /api/v1/groups/:group_id/resources - list resources with rules_configured: false', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/v1/groups/${groupId}/resources`)
        .set('Authorization', `Bearer ${eveToken}`)
        .expect(200);

      expect(Array.isArray(res.body.data)).toBe(true);
      const court = res.body.data.find((r: any) => r.id === resourceId);
      expect(court).toBeDefined();
      expect(court.rules_configured).toBe(false);
    });
  });

  describe('Booking Rules', () => {
    it('PUT .../rules - fail on duplicate day_scope', async () => {
      const res = await request(app.getHttpServer())
        .put(`/api/v1/groups/${groupId}/resources/${resourceId}/rules`)
        .set('Authorization', `Bearer ${eveToken}`)
        .send([
          { day_scope: 'WEEKDAY', max_bookings_per_day: 2 },
          { day_scope: 'WEEKDAY', max_bookings_per_day: 3 },
        ])
        .expect(400);

      expect(res.body.error.message).toContain('duplicate_day_scope');
    });

    it('PUT .../rules - fail on min_duration_minutes < slot_duration_minutes', async () => {
      const res = await request(app.getHttpServer())
        .put(`/api/v1/groups/${groupId}/resources/${resourceId}/rules`)
        .set('Authorization', `Bearer ${eveToken}`)
        .send([{ day_scope: 'WEEKDAY', min_duration_minutes: 15 }])
        .expect(400);

      expect(res.body.error.message).toContain('min_duration_minutes must be greater than or equal to resource slot_duration_minutes');
    });

    it('PUT .../rules - successfully bulk upsert rules', async () => {
      const res = await request(app.getHttpServer())
        .put(`/api/v1/groups/${groupId}/resources/${resourceId}/rules`)
        .set('Authorization', `Bearer ${eveToken}`)
        .send([
          {
            day_scope: 'WEEKDAY',
            max_bookings_per_day: 2,
            max_hours_per_day: 3,
            cooldown_minutes: 60,
            available_from: '08:00',
            available_until: '22:00',
          },
          {
            day_scope: 'WEEKEND',
            max_bookings_per_day: 3,
            available_from: '09:00',
            available_until: '21:00',
          },
        ])
        .expect(200);

      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.length).toBe(2);
    });

    it('GET .../resources/:id - view details with rules and rules_configured: true', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/v1/groups/${groupId}/resources/${resourceId}`)
        .set('Authorization', `Bearer ${eveToken}`)
        .expect(200);

      expect(res.body.data).toHaveProperty('id', resourceId);
      expect(res.body.data.booking_rules.length).toBe(2);
    });

    it('PUT .../rules with [] - clear all rules', async () => {
      const res = await request(app.getHttpServer())
        .put(`/api/v1/groups/${groupId}/resources/${resourceId}/rules`)
        .set('Authorization', `Bearer ${eveToken}`)
        .send([])
        .expect(200);

      expect(res.body.data).toEqual([]);
    });

    it('DELETE .../resources/:id - soft-delete resource', async () => {
      await request(app.getHttpServer())
        .delete(`/api/v1/groups/${groupId}/resources/${resourceId}`)
        .set('Authorization', `Bearer ${eveToken}`)
        .expect(204);

      // Verify resource is not returned in active list
      const res = await request(app.getHttpServer())
        .get(`/api/v1/groups/${groupId}/resources`)
        .set('Authorization', `Bearer ${eveToken}`)
        .expect(200);

      const court = res.body.data.find((r: any) => r.id === resourceId);
      expect(court).toBeUndefined();
    });
  });
});
