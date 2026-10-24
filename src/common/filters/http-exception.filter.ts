import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest ? ctx.getRequest<Request>() : undefined;

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = 'Internal server error';
    let details: any = null;

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const exceptionResponse = exception.getResponse();

      if (typeof exceptionResponse === 'string') {
        message = exceptionResponse;
      } else if (
        typeof exceptionResponse === 'object' &&
        exceptionResponse !== null
      ) {
        const resObj = exceptionResponse as Record<string, any>;

        if (Array.isArray(resObj.message)) {
          message = 'Validation failed';
          details = resObj.message;
        } else {
          message = resObj.message || resObj.error || exception.message;
          if (resObj.details) {
            details = resObj.details;
          }
        }
      }
    } else if (exception instanceof Error) {
      message = exception.message;
    }

    const reqLabel = request?.method && (request.originalUrl || request.url)
      ? `${request.method} ${request.originalUrl || request.url}`
      : 'HTTP Request';

    if (status >= HttpStatus.INTERNAL_SERVER_ERROR) {
      const stack = exception instanceof Error ? exception.stack : undefined;
      this.logger.error(
        `${reqLabel} -> ${status} ${message}`,
        stack,
      );
    } else {
      this.logger.warn(
        `${reqLabel} -> ${status} ${message}${details ? ` (Details: ${JSON.stringify(details)})` : ''}`,
      );
    }

    response.status(status).json({
      error: {
        status_code: status,
        message,
        ...(details ? { details } : {}),
      },
    });
  }
}
