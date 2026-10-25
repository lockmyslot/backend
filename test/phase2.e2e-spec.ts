import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import * as express from 'express';
import { AppModule } from './../src/app.module';
import { TransformInterceptor } from './../src/common/interceptors/transform.interceptor';
import { HttpExceptionFilter } from './../src/common/filters/http-exception.filter';
import { transformKeysToCamelCase } from './../src/common/middleware/snake-case.middleware';

describe('Phase 2 — Auth & Groups (e2e)', () => {
  let app: INestApplication;
  let charlieToken: string;
  let charlieUserId: string;
  let daveToken: string;
  let daveUserId: string;
  let groupId: string;
  let inviteCode: string;

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
  });

  afterAll(async () => {
    await app.close();
  });

  describe('Auth Endpoints', () => {
    it('POST /api/v1/auth/register - should register User 1 (Charlie)', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .send({ display_name: 'Charlie' })
        .expect(201);

      expect(res.body).toHaveProperty('data');
      expect(res.body.data).toHaveProperty('auth_token');
      expect(res.body.data).toHaveProperty('display_name', 'Charlie');

      charlieToken = res.body.data.auth_token;
      charlieUserId = res.body.data.id;
    });

    it('GET /api/v1/auth/me - should get profile for Charlie', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer ${charlieToken}`)
        .expect(200);

      expect(res.body.data).toHaveProperty('id', charlieUserId);
      expect(res.body.data).toHaveProperty('display_name', 'Charlie');
      expect(res.body.data).not.toHaveProperty('auth_token');
    });

    it('PATCH /api/v1/auth/me - should update Charlie display_name', async () => {
      const res = await request(app.getHttpServer())
        .patch('/api/v1/auth/me')
        .set('Authorization', `Bearer ${charlieToken}`)
        .send({ display_name: 'Charlie Brown' })
        .expect(200);

      expect(res.body.data).toHaveProperty('display_name', 'Charlie Brown');
    });

    it('POST /api/v1/auth/register - should register User 2 (Dave)', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .send({ display_name: 'Dave' })
        .expect(201);

      daveToken = res.body.data.auth_token;
      daveUserId = res.body.data.id;
    });
  });

  describe('Groups Endpoints', () => {
    it('POST /api/v1/groups - Charlie creates a group', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/groups')
        .set('Authorization', `Bearer ${charlieToken}`)
        .send({ name: "Charlie's Squad" })
        .expect(201);

      expect(res.body.data).toHaveProperty('name', "Charlie's Squad");
      expect(res.body.data).toHaveProperty('role', 'ADMIN');
      expect(res.body.data).toHaveProperty('invite_code');

      groupId = res.body.data.id;
      inviteCode = res.body.data.invite_code;
    });

    it('GET /api/v1/groups - Charlie lists their groups', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/groups')
        .set('Authorization', `Bearer ${charlieToken}`)
        .expect(200);

      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.length).toBeGreaterThanOrEqual(1);
    });

    it('POST /api/v1/groups/join - Dave joins Charlie group', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/groups/join')
        .set('Authorization', `Bearer ${daveToken}`)
        .send({ invite_code: inviteCode })
        .expect(201);

      expect(res.body.data).toHaveProperty('id', groupId);
      expect(res.body.data).toHaveProperty('role', 'MEMBER');
    });

    it('GET /api/v1/groups/:id/members - List members', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/v1/groups/${groupId}/members`)
        .set('Authorization', `Bearer ${charlieToken}`)
        .expect(200);

      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.length).toBe(2);
    });

    it('POST /api/v1/groups/:id/leave - Charlie (sole admin) cannot leave', async () => {
      const res = await request(app.getHttpServer())
        .post(`/api/v1/groups/${groupId}/leave`)
        .set('Authorization', `Bearer ${charlieToken}`)
        .expect(400);

      expect(res.body.error).toHaveProperty(
        'message',
        'sole_admin_cannot_leave',
      );
    });

    it('POST /api/v1/groups/:id/regenerate_invite - Charlie regenerates invite code', async () => {
      const res = await request(app.getHttpServer())
        .post(`/api/v1/groups/${groupId}/regenerate_invite`)
        .set('Authorization', `Bearer ${charlieToken}`)
        .expect(200);

      expect(res.body.data).toHaveProperty('invite_code');
      expect(res.body.data.invite_code).not.toBe(inviteCode);
    });

    it('PATCH /api/v1/groups/:id/pin - Dave pins the group to top', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/api/v1/groups/${groupId}/pin`)
        .set('Authorization', `Bearer ${daveToken}`)
        .send({ is_pinned: true })
        .expect(200);

      expect(res.body.data).toHaveProperty('id', groupId);
      expect(res.body.data).toHaveProperty('is_pinned', true);

      // Verify in Dave's group list
      const listRes = await request(app.getHttpServer())
        .get('/api/v1/groups')
        .set('Authorization', `Bearer ${daveToken}`)
        .expect(200);

      expect(listRes.body.data[0]).toHaveProperty('id', groupId);
      expect(listRes.body.data[0]).toHaveProperty('is_pinned', true);

      // Dave unpins the group
      const unpinRes = await request(app.getHttpServer())
        .patch(`/api/v1/groups/${groupId}/pin`)
        .set('Authorization', `Bearer ${daveToken}`)
        .send({ is_pinned: false })
        .expect(200);

      expect(unpinRes.body.data).toHaveProperty('is_pinned', false);
    });
  });
});
