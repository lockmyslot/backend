import {
  SnakeCaseMiddleware,
  transformKeysToCamelCase,
} from './snake-case.middleware';

describe('transformKeysToCamelCase', () => {
  it('should return null/undefined as-is', () => {
    expect(transformKeysToCamelCase(null)).toBeNull();
    expect(transformKeysToCamelCase(undefined)).toBeUndefined();
  });

  it('should transform nested object keys to camelCase', () => {
    const input = {
      display_name: 'Alice',
      max_bookings_per_day: 5,
      nested: { slot_duration_minutes: 30 },
    };
    expect(transformKeysToCamelCase(input)).toEqual({
      displayName: 'Alice',
      maxBookingsPerDay: 5,
      nested: { slotDurationMinutes: 30 },
    });
  });

  it('should transform array elements recursively', () => {
    const input = [{ display_name: 'Alice' }, { display_name: 'Bob' }];
    expect(transformKeysToCamelCase(input)).toEqual([
      { displayName: 'Alice' },
      { displayName: 'Bob' },
    ]);
  });

  it('should return non-plain objects (e.g. Date) as-is', () => {
    const date = new Date();
    expect(transformKeysToCamelCase(date)).toBe(date);
  });
});

describe('SnakeCaseMiddleware', () => {
  let middleware: SnakeCaseMiddleware;

  beforeEach(() => {
    middleware = new SnakeCaseMiddleware();
  });

  it('should transform body keys and call next', () => {
    const req: any = { body: { display_name: 'Alice' }, query: {} };
    const next = jest.fn();
    middleware.use(req, {} as any, next);

    expect(req.body).toEqual({ displayName: 'Alice' });
    expect(next).toHaveBeenCalled();
  });

  it('should transform query keys', () => {
    const req: any = { body: {}, query: { start_time: '09:00' } };
    const next = jest.fn();
    middleware.use(req, {} as any, next);

    expect(req.query).toEqual({ startTime: '09:00' });
  });

  it('should skip transformation when body is not an object', () => {
    const req: any = { body: null, query: {} };
    const next = jest.fn();
    middleware.use(req, {} as any, next);
    expect(req.body).toBeNull();
    expect(next).toHaveBeenCalled();
  });
});
