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

    it('POST /api/v1/groups/:id/invite - Admin can invite users by username', async () => {
      // 1. Register a third user with a username
      const eveRes = await request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .send({
          display_name: 'Eve',
          username: 'eve_user',
          password: 'password123',
        })
        .expect(201);
      const eveToken = eveRes.body.data.auth_token;
      expect(eveRes.body.data.username).toBe('eve_user');

      // 2. Non-admin (Dave) cannot invite members (403)
      await request(app.getHttpServer())
        .post(`/api/v1/groups/${groupId}/invite`)
        .set('Authorization', `Bearer ${daveToken}`)
        .send({ username: 'eve_user' })
        .expect(403);

      // 3. Admin cannot invite nonexistent username (404)
      const notFoundRes = await request(app.getHttpServer())
        .post(`/api/v1/groups/${groupId}/invite`)
        .set('Authorization', `Bearer ${charlieToken}`)
        .send({ username: 'nonexistent_user_999' })
        .expect(404);
      expect(notFoundRes.body.error).toHaveProperty(
        'message',
        'user_not_found',
      );

      // 4. Admin cannot invite themselves (400)
      // Update charlie with username first
      await request(app.getHttpServer())
        .patch('/api/v1/auth/me')
        .set('Authorization', `Bearer ${charlieToken}`)
        .send({ display_name: 'Charlie Admin' });

      // 5. Admin (Charlie) successfully invites Eve using @eve_user (201)
      const inviteRes = await request(app.getHttpServer())
        .post(`/api/v1/groups/${groupId}/invite`)
        .set('Authorization', `Bearer ${charlieToken}`)
        .send({ username: '@eve_user' })
        .expect(201);

      expect(inviteRes.body.data).toHaveProperty('username', 'eve_user');
      expect(inviteRes.body.data).toHaveProperty('status', 'PENDING');
      expect(inviteRes.body.data).toHaveProperty('group_id', groupId);
      const inviteId = inviteRes.body.data.id;

      // 6. Admin cannot re-invite while pending (409)
      const conflictRes = await request(app.getHttpServer())
        .post(`/api/v1/groups/${groupId}/invite`)
        .set('Authorization', `Bearer ${charlieToken}`)
        .send({ username: 'eve_user' })
        .expect(409);
      expect(conflictRes.body.error).toHaveProperty(
        'message',
        'invite_already_pending',
      );

      // 7. Eve sees the pending invite in her pending invites list
      const eveInvitesRes = await request(app.getHttpServer())
        .get('/api/v1/invites')
        .set('Authorization', `Bearer ${eveToken}`)
        .expect(200);
      expect(Array.isArray(eveInvitesRes.body.data)).toBe(true);
      expect(eveInvitesRes.body.data.length).toBe(1);
      expect(eveInvitesRes.body.data[0]).toHaveProperty('id', inviteId);
      expect(eveInvitesRes.body.data[0]).toHaveProperty('group_id', groupId);
      expect(eveInvitesRes.body.data[0]).toHaveProperty('status', 'PENDING');

      // 8. Eve accepts the invite
      const acceptRes = await request(app.getHttpServer())
        .post(`/api/v1/invites/${inviteId}/accept`)
        .set('Authorization', `Bearer ${eveToken}`)
        .expect(200);
      expect(acceptRes.body.data).toHaveProperty('status', 'ACCEPTED');

      // 9. Eve now sees 0 pending invites
      const eveInvitesAfterRes = await request(app.getHttpServer())
        .get('/api/v1/invites')
        .set('Authorization', `Bearer ${eveToken}`)
        .expect(200);
      expect(eveInvitesAfterRes.body.data.length).toBe(0);

      // 10. Verify Eve sees the group in her groups list
      const eveGroupsRes = await request(app.getHttpServer())
        .get('/api/v1/groups')
        .set('Authorization', `Bearer ${eveToken}`)
        .expect(200);
      expect(eveGroupsRes.body.data.some((g: any) => g.id === groupId)).toBe(
        true,
      );

      // 11. Verify members list includes Eve with username
      const membersRes = await request(app.getHttpServer())
        .get(`/api/v1/groups/${groupId}/members`)
        .set('Authorization', `Bearer ${charlieToken}`)
        .expect(200);
      const eveMember = membersRes.body.data.find(
        (m: any) => m.username === 'eve_user',
      );
      expect(eveMember).toBeDefined();
      expect(eveMember.role).toBe('MEMBER');

      // 12. Admin inviting Eve now returns 409 already_a_member
      const reInviteRes = await request(app.getHttpServer())
        .post(`/api/v1/groups/${groupId}/invite`)
        .set('Authorization', `Bearer ${charlieToken}`)
        .send({ username: 'eve_user' })
        .expect(409);
      expect(reInviteRes.body.error).toHaveProperty(
        'message',
        'already_a_member',
      );

      // 13. Test declining an invite with a new user Frank
      const frankRes = await request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .send({
          display_name: 'Frank',
          username: 'frank_user',
          password: 'password123',
        })
        .expect(201);
      const frankToken = frankRes.body.data.auth_token;

      const frankInviteRes = await request(app.getHttpServer())
        .post(`/api/v1/groups/${groupId}/invite`)
        .set('Authorization', `Bearer ${charlieToken}`)
        .send({ username: 'frank_user' })
        .expect(201);
      const frankInviteId = frankInviteRes.body.data.id;

      // Frank declines the invite
      const declineRes = await request(app.getHttpServer())
        .post(`/api/v1/invites/${frankInviteId}/decline`)
        .set('Authorization', `Bearer ${frankToken}`)
        .expect(200);
      expect(declineRes.body.data).toHaveProperty('status', 'DECLINED');

      // Frank sees 0 pending invites
      const frankInvitesRes = await request(app.getHttpServer())
        .get('/api/v1/invites')
        .set('Authorization', `Bearer ${frankToken}`)
        .expect(200);
      expect(frankInvitesRes.body.data.length).toBe(0);
    });
  });
});
