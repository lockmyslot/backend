import { BookingRulesController } from './booking-rules.controller';
import { BookingRulesService } from './booking-rules.service';

describe('BookingRulesController', () => {
  let controller: BookingRulesController;
  let bookingRulesService: jest.Mocked<BookingRulesService>;

  beforeEach(() => {
    bookingRulesService = {
      getRules: jest.fn(),
      upsertRules: jest.fn(),
    } as any;
    controller = new BookingRulesController(bookingRulesService);
  });

  it('should delegate getRules', async () => {
    bookingRulesService.getRules.mockResolvedValue([]);

    const result = await controller.getRules('group-1', 'res-1');
    expect(bookingRulesService.getRules).toHaveBeenCalledWith(
      'group-1',
      'res-1',
    );
    expect(result).toEqual([]);
  });

  it('should delegate upsertRules', async () => {
    const rules = [{ dayScope: 'WEEKDAY', maxBookingsPerDay: 2 } as any];
    bookingRulesService.upsertRules.mockResolvedValue([]);

    const result = await controller.upsertRules('group-1', 'res-1', rules);
    expect(bookingRulesService.upsertRules).toHaveBeenCalledWith(
      'group-1',
      'res-1',
      rules,
    );
    expect(result).toEqual([]);
  });

  it('should default to an empty array when rules is undefined', async () => {
    bookingRulesService.upsertRules.mockResolvedValue([]);

    const result = await controller.upsertRules('group-1', 'res-1', undefined);
    expect(bookingRulesService.upsertRules).toHaveBeenCalledWith(
      'group-1',
      'res-1',
      [],
    );
    expect(result).toEqual([]);
  });
});
