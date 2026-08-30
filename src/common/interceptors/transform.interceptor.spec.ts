import { of } from 'rxjs';
import {
  TransformInterceptor,
  transformKeysToSnakeCase,
} from './transform.interceptor';

describe('TransformInterceptor', () => {
  let interceptor: TransformInterceptor<any>;

  beforeEach(() => {
    interceptor = new TransformInterceptor();
  });

  it('should convert camelCase keys to snake_case', () => {
    const input = {
      displayName: 'Alice',
      maxBookingsPerDay: 5,
      nestedObject: {
        slotDurationMinutes: 30,
      },
    };

    const expected = {
      display_name: 'Alice',
      max_bookings_per_day: 5,
      nested_object: {
        slot_duration_minutes: 30,
      },
    };

    expect(transformKeysToSnakeCase(input)).toEqual(expected);
  });

  it('should wrap output in data and meta envelope', (done) => {
    const mockCallHandler = {
      handle: () => of({ displayName: 'Alice' }),
    };

    interceptor
      .intercept({} as any, mockCallHandler as any)
      .subscribe((result) => {
        expect(result).toEqual({
          data: { display_name: 'Alice' },
          meta: {},
        });
        done();
      });
  });

  it('should return null data and empty meta when response is null', (done) => {
    const mockCallHandler = { handle: () => of(null) };
    interceptor
      .intercept({} as any, mockCallHandler as any)
      .subscribe((result) => {
        expect(result).toEqual({ data: null, meta: {} });
        done();
      });
  });

  it('should return null data when response is undefined', (done) => {
    const mockCallHandler = { handle: () => of(undefined) };
    interceptor
      .intercept({} as any, mockCallHandler as any)
      .subscribe((result) => {
        expect(result).toEqual({ data: null, meta: {} });
        done();
      });
  });

  it('should pass through an already-enveloped response', (done) => {
    const mockCallHandler = {
      handle: () => of({ data: { displayName: 'Alice' }, meta: { count: 1 } }),
    };
    interceptor
      .intercept({} as any, mockCallHandler as any)
      .subscribe((result) => {
        expect(result).toEqual({
          data: { display_name: 'Alice' },
          meta: { count: 1 },
        });
        done();
      });
  });

  it('should transform array responses', (done) => {
    const mockCallHandler = {
      handle: () => of([{ displayName: 'Alice' }]),
    };
    interceptor
      .intercept({} as any, mockCallHandler as any)
      .subscribe((result) => {
        expect(result).toEqual({
          data: [{ display_name: 'Alice' }],
          meta: {},
        });
        done();
      });
  });

  it('should convert Date values to ISO strings', (done) => {
    const mockCallHandler = {
      handle: () => of({ createdAt: new Date('2026-08-11T09:00:00.000Z') }),
    };
    interceptor
      .intercept({} as any, mockCallHandler as any)
      .subscribe((result) => {
        expect(result).toEqual({
          data: { created_at: '2026-08-11T09:00:00.000Z' },
          meta: {},
        });
        done();
      });
  });
});
