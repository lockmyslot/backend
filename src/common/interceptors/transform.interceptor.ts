import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

function toSnakeCase(str: string): string {
  return str.replace(/([a-z0-9])([A-Z])/g, '$1_$2').toLowerCase();
}

export function transformKeysToSnakeCase(obj: any): any {
  if (obj === null || obj === undefined) {
    return obj;
  }

  if (obj instanceof Date) {
    return obj.toISOString();
  }

  if (Array.isArray(obj)) {
    return obj.map((item) => transformKeysToSnakeCase(item));
  }

  if (typeof obj === 'object' && obj.constructor === Object) {
    const transformed: Record<string, any> = {};
    for (const key of Object.keys(obj)) {
      const snakeKey = toSnakeCase(key);
      transformed[snakeKey] = transformKeysToSnakeCase(obj[key]);
    }
    return transformed;
  }

  return obj;
}

export interface ResponseEnvelope<T> {
  data: T;
  meta: Record<string, any>;
}

@Injectable()
export class TransformInterceptor<T> implements NestInterceptor<
  T,
  ResponseEnvelope<any>
> {
  intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Observable<ResponseEnvelope<any>> {
    return next.handle().pipe(
      map((res) => {
        if (res === null || res === undefined) {
          return {
            data: null,
            meta: {},
          };
        }

        if (typeof res === 'object' && res !== null && 'data' in res) {
          return {
            data: transformKeysToSnakeCase(res.data),
            meta: transformKeysToSnakeCase(res.meta || {}),
          };
        }

        const transformedData = transformKeysToSnakeCase(res);
        return {
          data: transformedData,
          meta: {},
        };
      }),
    );
  }
}
