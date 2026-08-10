import { of } from 'rxjs';
import { TransformInterceptor, transformKeysToSnakeCase } from './transform.interceptor';

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

    interceptor.intercept({} as any, mockCallHandler as any).subscribe((result) => {
      expect(result).toEqual({
        data: { display_name: 'Alice' },
        meta: {},
      });
      done();
    });
  });
});
