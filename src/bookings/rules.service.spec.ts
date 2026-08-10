import { Test, TestingModule } from '@nestjs/testing';
import { RulesService } from './rules.service';
import { PrismaService } from '../prisma/prisma.service';
import { Resource, DayScope, BookingStatus } from '@prisma/client';

describe('RulesService (Rule Evaluation Engine)', () => {
  let service: RulesService;
  let prismaService: jest.Mocked<PrismaService>;

  const mockResource: Resource = {
    id: 'res-1',
    groupId: 'group-1',
    name: 'Washing Machine',
    description: 'Laundry',
    capacity: 1,
    slotDurationMinutes: 60,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    const mockPrisma = {
      bookingRule: {
        findFirst: jest.fn(),
      },
      booking: {
        count: jest.fn(),
        findMany: jest.fn(),
        findFirst: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RulesService,
        {
          provide: PrismaService,
          useValue: mockPrisma,
        },
      ],
    }).compile();

    service = module.get<RulesService>(RulesService);
    prismaService = module.get(PrismaService);
  });

  const getTomorrowAt = (hour: number, min = 0) => {
    const d = new Date();
    d.setUTCDate(d.getUTCDate() + 1);
    d.setUTCHours(hour, min, 0, 0);
    return d;
  };

  it('1. should allow booking within all rules', async () => {
    const start = getTomorrowAt(10);
    const end = getTomorrowAt(11);

    (prismaService.bookingRule.findFirst as jest.Mock).mockResolvedValue({
      id: 'rule-1',
      resourceId: 'res-1',
      dayScope: DayScope.WEEKDAY,
      availableFrom: '08:00',
      availableUntil: '22:00',
      maxBookingsPerDay: 2,
    });
    (prismaService.booking.count as jest.Mock).mockResolvedValue(0);

    const res = await service.validate(mockResource, 'user-1', 'group-1', start, end);
    expect(res.allowed).toBe(true);
    expect(res.violations).toHaveLength(0);
  });

  it('2. should reject booking outside availability window', async () => {
    const start = getTomorrowAt(6);
    const end = getTomorrowAt(7);

    (prismaService.bookingRule.findFirst as jest.Mock).mockResolvedValue({
      id: 'rule-1',
      resourceId: 'res-1',
      dayScope: DayScope.WEEKDAY,
      availableFrom: '08:00',
      availableUntil: '22:00',
    });
    (prismaService.booking.count as jest.Mock).mockResolvedValue(0);

    const res = await service.validate(mockResource, 'user-1', 'group-1', start, end);
    expect(res.allowed).toBe(false);
    expect(res.violations[0]).toContain('starts before available_from');
  });

  it('3. should reject booking duration below minimum', async () => {
    const resWith15Min = { ...mockResource, slotDurationMinutes: 15 };
    const start = getTomorrowAt(10, 0);
    const end = getTomorrowAt(10, 15);

    (prismaService.bookingRule.findFirst as jest.Mock).mockResolvedValue({
      id: 'rule-1',
      resourceId: 'res-1',
      dayScope: DayScope.WEEKDAY,
      minDurationMinutes: 30,
    });
    (prismaService.booking.count as jest.Mock).mockResolvedValue(0);

    const res = await service.validate(resWith15Min, 'user-1', 'group-1', start, end);
    expect(res.allowed).toBe(false);
    expect(res.violations[0]).toContain('min_duration');
  });

  it('4. should reject booking duration above maximum', async () => {
    const start = getTomorrowAt(10);
    const end = getTomorrowAt(14); // 4 hours = 240 mins

    (prismaService.bookingRule.findFirst as jest.Mock).mockResolvedValue({
      id: 'rule-1',
      resourceId: 'res-1',
      dayScope: DayScope.WEEKDAY,
      maxDurationMinutes: 120,
    });
    (prismaService.booking.count as jest.Mock).mockResolvedValue(0);

    const res = await service.validate(mockResource, 'user-1', 'group-1', start, end);
    expect(res.allowed).toBe(false);
    expect(res.violations[0]).toContain('max_duration');
  });

  it('5. should reject duration not a multiple of slotDurationMinutes', async () => {
    const start = getTomorrowAt(10, 0);
    const end = getTomorrowAt(10, 45); // 45 mins vs 60 mins slot

    (prismaService.bookingRule.findFirst as jest.Mock).mockResolvedValue(null);
    (prismaService.booking.count as jest.Mock).mockResolvedValue(0);

    const res = await service.validate(mockResource, 'user-1', 'group-1', start, end);
    expect(res.allowed).toBe(false);
    expect(res.violations[0]).toContain('multiple of slot_duration_minutes');
  });

  it('6. should reject when max_bookings_per_day is reached', async () => {
    const start = getTomorrowAt(10);
    const end = getTomorrowAt(11);

    (prismaService.bookingRule.findFirst as jest.Mock).mockResolvedValue({
      id: 'rule-1',
      resourceId: 'res-1',
      dayScope: DayScope.WEEKDAY,
      maxBookingsPerDay: 2,
    });
    // User already has 2 bookings today
    (prismaService.booking.count as jest.Mock).mockImplementation((args: any) => {
      if (args.where?.userId) return Promise.resolve(2);
      return Promise.resolve(0);
    });

    const res = await service.validate(mockResource, 'user-1', 'group-1', start, end);
    expect(res.allowed).toBe(false);
    expect(res.violations[0]).toContain('max_bookings_per_day');
  });

  it('7. should reject when max_hours_per_day would be exceeded', async () => {
    const start = getTomorrowAt(14);
    const end = getTomorrowAt(16); // 2 hours

    (prismaService.bookingRule.findFirst as jest.Mock).mockResolvedValue({
      id: 'rule-1',
      resourceId: 'res-1',
      dayScope: DayScope.WEEKDAY,
      maxHoursPerDay: 3,
    });
    (prismaService.booking.count as jest.Mock).mockResolvedValue(0);
    // User has already booked 2 hours today
    (prismaService.booking.findMany as jest.Mock).mockResolvedValue([
      {
        startTime: getTomorrowAt(8),
        endTime: getTomorrowAt(10),
      },
    ]);

    const res = await service.validate(mockResource, 'user-1', 'group-1', start, end);
    expect(res.allowed).toBe(false);
    expect(res.violations[0]).toContain('max_hours_per_day');
  });

  it('8. should reject if violating cooldown before', async () => {
    const start = getTomorrowAt(10, 30);
    const end = getTomorrowAt(11, 30);

    (prismaService.bookingRule.findFirst as jest.Mock).mockResolvedValue({
      id: 'rule-1',
      resourceId: 'res-1',
      dayScope: DayScope.WEEKDAY,
      cooldownMinutes: 60,
    });
    (prismaService.booking.count as jest.Mock).mockResolvedValue(0);
    // Nearest previous booking ended 30 mins ago (10:00)
    (prismaService.booking.findFirst as jest.Mock).mockResolvedValueOnce(null).mockResolvedValueOnce({
      startTime: getTomorrowAt(9),
      endTime: getTomorrowAt(10),
    });

    const res = await service.validate({ ...mockResource, slotDurationMinutes: 30 }, 'user-1', 'group-1', start, end);
    expect(res.allowed).toBe(false);
    expect(res.violations[0]).toContain('cooldown');
  });

  it('9. should reject if capacity is full', async () => {
    const start = getTomorrowAt(10);
    const end = getTomorrowAt(11);

    (prismaService.bookingRule.findFirst as jest.Mock).mockResolvedValue(null);
    (prismaService.booking.count as jest.Mock).mockResolvedValue(1); // capacity is 1, booked is 1

    const res = await service.validate(mockResource, 'user-1', 'group-1', start, end);
    expect(res.allowed).toBe(false);
    expect(res.isCapacityError).toBe(true);
    expect(res.violations[0]).toContain('capacity reached');
  });

  it('10. should allow booking if no rules configured and capacity available', async () => {
    const start = getTomorrowAt(10);
    const end = getTomorrowAt(11);

    (prismaService.bookingRule.findFirst as jest.Mock).mockResolvedValue(null);
    (prismaService.booking.count as jest.Mock).mockResolvedValue(0);

    const res = await service.validate(mockResource, 'user-1', 'group-1', start, end);
    expect(res.allowed).toBe(true);
  });

  it('11. should reject booking in the past', async () => {
    const start = new Date(Date.now() - 3600000);
    const end = new Date(Date.now() - 1800000);

    const res = await service.validate(mockResource, 'user-1', 'group-1', start, end);
    expect(res.allowed).toBe(false);
    expect(res.violations[0]).toContain('in the future');
  });

  it('12. should reject if resource is inactive', async () => {
    const inactiveRes = { ...mockResource, isActive: false };
    const start = getTomorrowAt(10);
    const end = getTomorrowAt(11);

    const res = await service.validate(inactiveRes, 'user-1', 'group-1', start, end);
    expect(res.allowed).toBe(false);
    expect(res.violations[0]).toContain('resource is inactive');
  });
});
