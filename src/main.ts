import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import * as express from 'express';
import * as os from 'os';
import { AppModule } from './app.module';
import { TransformInterceptor } from './common/interceptors/transform.interceptor';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { transformKeysToCamelCase } from './common/middleware/snake-case.middleware';

function getLocalIpAddress(): string | null {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name] || []) {
      if (iface.family === 'IPv4' && !iface.internal) {
        return iface.address;
      }
    }
  }
  return null;
}

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.enableCors();
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

  const config = new DocumentBuilder()
    .setTitle('OpenSlot API')
    .setDescription('Resource booking API for small groups')
    .setVersion('1.0')
    .addBearerAuth()
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);

  const port = process.env.PORT || 3000;
  await app.listen(port, '0.0.0.0');

  const localIp = getLocalIpAddress();
  console.log(`OpenSlot API running at:`);
  console.log(`  - Local:   http://localhost:${port}/api/v1`);
  if (localIp) {
    console.log(`  - Network: http://${localIp}:${port}/api/v1`);
  }
  console.log(`Swagger docs available at:`);
  console.log(`  - Local:   http://localhost:${port}/api/docs`);
  if (localIp) {
    console.log(`  - Network: http://${localIp}:${port}/api/docs`);
  }
}
bootstrap();
