import {
  HttpException,
  HttpStatus,
  BadRequestException,
  ArgumentsHost,
} from '@nestjs/common';
import { Response } from 'express';
import { HttpExceptionFilter } from './http-exception.filter';

describe('HttpExceptionFilter', () => {
  let filter: HttpExceptionFilter;
  let response: jest.Mocked<Response>;
  let host: ArgumentsHost;

  const createHost = () => {
    response = { status: jest.fn().mockReturnThis(), json: jest.fn() } as any;
    host = {
      switchToHttp: () => ({ getResponse: () => response }),
    } as any;
    return { response, host };
  };

  beforeEach(() => {
    filter = new HttpExceptionFilter();
  });

  it('should respond with the status and message for a string HttpException', () => {
    createHost();
    const exception = new HttpException(
      'Something went wrong',
      HttpStatus.BAD_REQUEST,
    );
    filter.catch(exception, host);
    expect(response.status).toHaveBeenCalledWith(HttpStatus.BAD_REQUEST);
    expect(response.json).toHaveBeenCalledWith({
      error: {
        status_code: HttpStatus.BAD_REQUEST,
        message: 'Something went wrong',
      },
    });
  });

  it('should respond with "Validation failed" and details for array message', () => {
    createHost();
    const exception = new BadRequestException([
      'field is required',
      'other error',
    ]);
    filter.catch(exception, host);
    expect(response.json).toHaveBeenCalledWith({
      error: {
        status_code: HttpStatus.BAD_REQUEST,
        message: 'Validation failed',
        details: ['field is required', 'other error'],
      },
    });
  });

  it('should include details when present in the exception response', () => {
    createHost();
    const exception = new HttpException(
      { message: 'booking_rule_violation', details: ['rule'] },
      HttpStatus.BAD_REQUEST,
    );
    filter.catch(exception, host);
    expect(response.json).toHaveBeenCalledWith({
      error: {
        status_code: HttpStatus.BAD_REQUEST,
        message: 'booking_rule_violation',
        details: ['rule'],
      },
    });
  });

  it('should respond with internal server error for a non-HttpException', () => {
    createHost();
    filter.catch(new Error('boom'), host);
    expect(response.status).toHaveBeenCalledWith(
      HttpStatus.INTERNAL_SERVER_ERROR,
    );
    expect(response.json).toHaveBeenCalledWith({
      error: { status_code: 500, message: 'boom' },
    });
  });

  it('should respond with default message for unknown exception', () => {
    createHost();
    filter.catch('not an error object', host);
    expect(response.status).toHaveBeenCalledWith(
      HttpStatus.INTERNAL_SERVER_ERROR,
    );
    expect(response.json).toHaveBeenCalledWith({
      error: { status_code: 500, message: 'Internal server error' },
    });
  });
});
