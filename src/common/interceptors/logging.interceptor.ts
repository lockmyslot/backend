import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { Request, Response } from 'express';

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger('HTTP');

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const ctx = context.switchToHttp();
    const req = ctx.getRequest<Request>();
    const method = req?.method ?? 'UNKNOWN';
    const targetUrl = req?.originalUrl || req?.url || '';
    const startTime = Date.now();

    return next.handle().pipe(
      tap({
        next: () => {
          const res = ctx.getResponse<Response>();
          const statusCode = res?.statusCode ?? 200;
          const duration = Date.now() - startTime;
          this.logger.log(`${method} ${targetUrl} ${statusCode} +${duration}ms`);
        },
        error: (err) => {
          const duration = Date.now() - startTime;
          const status =
            err && typeof err === 'object' && 'status' in err
              ? (err as any).status
              : err && typeof err === 'object' && 'getStatus' in err && typeof (err as any).getStatus === 'function'
                ? (err as any).getStatus()
                : 500;
          this.logger.warn(
            `${method} ${targetUrl} ${status} +${duration}ms - ${err?.message || 'Error'}`,
          );
        },
      }),
    );
  }
}
