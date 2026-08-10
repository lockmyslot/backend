import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';

function toCamelCase(str: string): string {
  return str.replace(/_([a-z0-9])/g, (_, letter) => letter.toUpperCase());
}

export function transformKeysToCamelCase(obj: any): any {
  if (obj === null || obj === undefined) {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map((item) => transformKeysToCamelCase(item));
  }

  if (typeof obj === 'object' && obj.constructor === Object) {
    const transformed: Record<string, any> = {};
    for (const key of Object.keys(obj)) {
      const camelKey = toCamelCase(key);
      transformed[camelKey] = transformKeysToCamelCase(obj[key]);
    }
    return transformed;
  }

  return obj;
}

@Injectable()
export class SnakeCaseMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction) {
    if (req.body && typeof req.body === 'object') {
      req.body = transformKeysToCamelCase(req.body);
    }
    if (req.query && typeof req.query === 'object') {
      const transformedQuery = transformKeysToCamelCase(req.query);
      for (const key of Object.keys(req.query)) {
        delete (req.query as any)[key];
      }
      Object.assign(req.query, transformedQuery);
    }
    next();
  }
}
