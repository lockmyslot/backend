import { CallHandler, ExecutionContext, Logger } from '@nestjs/common';
import { of, throwError } from 'rxjs';
import { LoggingInterceptor } from './logging.interceptor';

describe('LoggingInterceptor', () => {
  let interceptor: LoggingInterceptor;
  let context: ExecutionContext;
  let callHandler: CallHandler;

  beforeEach(() => {
    interceptor = new LoggingInterceptor();
  });

  it('should log successful requests and pass through response', (done) => {
    const mockRequest = { method: 'GET', originalUrl: '/api/v1/resources' };
    const mockResponse = { statusCode: 200 };
    context = {
      switchToHttp: () => ({
        getRequest: () => mockRequest,
        getResponse: () => mockResponse,
      }),
    } as any;

    callHandler = {
      handle: () => of({ success: true }),
    };

    const logSpy = jest.spyOn((interceptor as any).logger, 'log').mockImplementation();

    interceptor.intercept(context, callHandler).subscribe({
      next: (val) => {
        expect(val).toEqual({ success: true });
        expect(logSpy).toHaveBeenCalledWith(
          expect.stringContaining('GET /api/v1/resources 200'),
        );
        done();
      },
    });
  });

  it('should log error requests when callHandler throws', (done) => {
    const mockRequest = { method: 'POST', originalUrl: '/api/v1/bookings' };
    context = {
      switchToHttp: () => ({
        getRequest: () => mockRequest,
        getResponse: () => ({ statusCode: 400 }),
      }),
    } as any;

    const error = { message: 'Conflict', status: 409 };
    callHandler = {
      handle: () => throwError(() => error),
    };

    const warnSpy = jest.spyOn((interceptor as any).logger, 'warn').mockImplementation();

    interceptor.intercept(context, callHandler).subscribe({
      error: (err) => {
        expect(err).toBe(error);
        expect(warnSpy).toHaveBeenCalledWith(
          expect.stringContaining('POST /api/v1/bookings 409'),
        );
        done();
      },
    });
  });
});
