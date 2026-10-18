import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import * as express from 'express';
import { AppModule } from './../src/app.module';
import { TransformInterceptor } from './../src/common/interceptors/transform.interceptor';
import { HttpExceptionFilter } from './../src/common/filters/http-exception.filter';
import { transformKeysToCamelCase } from './../src/common/middleware/snake-case.middleware';

describe('Maintenance Task User Assignment (e2e)', () => {
  let app: INestApplication;
  let adminToken: string;
  let adminId: string;
  let memberToken: string;
  let memberId: string;
  let otherMemberToken: string;
  let groupId: string;
  let resourceId: string;
  let taskId: string;

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
        Object.defineProperty(req, 'query', {
          value: transformedQuery,
          writable: true,
          enumerable: true,
          configurable: true,
        });
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

    // 1. Register Admin
    const adminReg = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({ display_name: 'Admin Alice' })
      .expect(201);
    adminToken = adminReg.body.data.auth_token;
    adminId = adminReg.body.data.id;

    // 2. Register Member (Assignee)
    const memberReg = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({ display_name: 'Technician Bob' })
      .expect(201);
    memberToken = memberReg.body.data.auth_token;
    memberId = memberReg.body.data.id;

    // 3. Register Other Member (Unassigned)
    const otherReg = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({ display_name: 'Member Charlie' })
      .expect(201);
    otherMemberToken = otherReg.body.data.auth_token;

    // 4. Admin creates group
    const groupRes = await request(app.getHttpServer())
      .post('/api/v1/groups')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Maintenance Facility Group' })
      .expect(201);
    groupId = groupRes.body.data.id;
    const inviteCode = groupRes.body.data.invite_code;

    // 5. Bob and Charlie join group
    await request(app.getHttpServer())
      .post('/api/v1/groups/join')
      .set('Authorization', `Bearer ${memberToken}`)
      .send({ invite_code: inviteCode })
      .expect(201);

    await request(app.getHttpServer())
      .post('/api/v1/groups/join')
      .set('Authorization', `Bearer ${otherMemberToken}`)
      .send({ invite_code: inviteCode })
      .expect(201);

    // 6. Admin creates resource
    const resRes = await request(app.getHttpServer())
      .post(`/api/v1/groups/${groupId}/resources`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: 'Air Compressor Unit',
        capacity: 1,
        slot_duration_minutes: 60,
      })
      .expect(201);
    resourceId = resRes.body.data.id;
  });

  afterAll(async () => {
    await app.close();
  });

  it('rejects scheduling when assigned user is not a group member', async () => {
    const fakeUserId = '00000000-0000-0000-0000-000000000000';
    await request(app.getHttpServer())
      .post(`/api/v1/groups/${groupId}/resources/${resourceId}/maintenance`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        title: 'Filter Swap',
        start_time: '2026-11-01T10:00:00Z',
        end_time: '2026-11-01T12:00:00Z',
        assigned_to_id: fakeUserId,
      })
      .expect(400);
  });

  it('schedules maintenance task assigned to Technician Bob', async () => {
    const res = await request(app.getHttpServer())
      .post(`/api/v1/groups/${groupId}/resources/${resourceId}/maintenance`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        title: 'Filter Swap',
        description: 'Replace HEPA intake filter',
        start_time: '2026-11-01T10:00:00Z',
        end_time: '2026-11-01T12:00:00Z',
        assigned_to_id: memberId,
      })
      .expect(201);

    expect(res.body.data).toHaveProperty('id');
    expect(res.body.data.assigned_to_id).toBe(memberId);
    expect(res.body.data.assigned_to_name).toBe('Technician Bob');
    taskId = res.body.data.id;
  });

  it('filters maintenance tasks by assigned_to_id', async () => {
    const res = await request(app.getHttpServer())
      .get(
        `/api/v1/groups/${groupId}/resources/${resourceId}/maintenance?assigned_to_id=${memberId}`,
      )
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data.length).toBe(1);
    expect(res.body.data[0].id).toBe(taskId);
    expect(res.body.data[0].assigned_to_name).toBe('Technician Bob');
  });

  it('filters maintenance tasks by assigned_to_me for Bob', async () => {
    const res = await request(app.getHttpServer())
      .get(`/api/v1/groups/${groupId}/maintenance?assigned_to_me=true`)
      .set('Authorization', `Bearer ${memberToken}`)
      .expect(200);

    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data.length).toBe(1);
    expect(res.body.data[0].id).toBe(taskId);
  });

  it('returns empty list for assigned_to_me when caller has no assigned tasks', async () => {
    const res = await request(app.getHttpServer())
      .get(`/api/v1/groups/${groupId}/maintenance?assigned_to_me=true`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data.length).toBe(0);
  });

  it('prevents non-assigned member Charlie from updating task status', async () => {
    await request(app.getHttpServer())
      .patch(
        `/api/v1/groups/${groupId}/resources/${resourceId}/maintenance/${taskId}`,
      )
      .set('Authorization', `Bearer ${otherMemberToken}`)
      .send({ status: 'IN_PROGRESS' })
      .expect(403);
  });

  it('allows assigned technician Bob to advance status to IN_PROGRESS', async () => {
    const res = await request(app.getHttpServer())
      .patch(
        `/api/v1/groups/${groupId}/resources/${resourceId}/maintenance/${taskId}`,
      )
      .set('Authorization', `Bearer ${memberToken}`)
      .send({ status: 'IN_PROGRESS' })
      .expect(200);

    expect(res.body.data.status).toBe('IN_PROGRESS');
    expect(res.body.data.assigned_to_name).toBe('Technician Bob');
  });

  it('prevents assigned technician Bob from editing title or schedule', async () => {
    await request(app.getHttpServer())
      .patch(
        `/api/v1/groups/${groupId}/resources/${resourceId}/maintenance/${taskId}`,
      )
      .set('Authorization', `Bearer ${memberToken}`)
      .send({ title: 'New Unauthorized Title' })
      .expect(403);
  });

  it('allows admin Alice to reassign task to Charlie or unassign', async () => {
    const res = await request(app.getHttpServer())
      .patch(
        `/api/v1/groups/${groupId}/resources/${resourceId}/maintenance/${taskId}`,
      )
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ assigned_to_id: null })
      .expect(200);

    expect(res.body.data.assigned_to_id).toBeNull();
    expect(res.body.data.assigned_to_name).toBeNull();
  });
});
