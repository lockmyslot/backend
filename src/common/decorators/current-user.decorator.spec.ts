import { Test, TestingModule } from '@nestjs/testing';
import {
  Controller,
  Get,
  INestApplication,
  MiddlewareConsumer,
  Module,
  NestModule,
  RequestMethod,
} from '@nestjs/common';
import request from 'supertest';
import { CurrentUser } from './current-user.decorator';

@Controller('test')
class TestController {
  @Get('full')
  getFull(@CurrentUser() user: any) {
    return user;
  }

  @Get('field')
  getField(@CurrentUser('displayName') name: any) {
    return name;
  }
}

@Module({ controllers: [TestController] })
class TestModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply((req: any, res: any, next: any) => {
        req.user = { id: 'user-1', displayName: 'Alice' };
        next();
      })
      .forRoutes({ path: '*', method: RequestMethod.ALL });
  }
}

describe('CurrentUser decorator', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [TestModule],
    }).compile();
    app = module.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('should return the full user when no data key provided', async () => {
    const res = await request(app.getHttpServer()).get('/test/full');
    expect(res.body).toEqual({ id: 'user-1', displayName: 'Alice' });
  });

  it('should extract the displayName field when a data key is provided', async () => {
    const res = await request(app.getHttpServer()).get('/test/field');
    expect(res.text).toBe('Alice');
  });
});
