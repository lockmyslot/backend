import { Test, TestingModule } from '@nestjs/testing';
import { BookingRulesService } from './booking-rules.service';
import { PrismaService } from '../prisma/prisma.service';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { DayScope } from '@prisma/client';

describe('BookingRulesService', () => {
  let service: BookingRulesService;
  let prismaService: jest.Mocked<PrismaService>;

  beforeEach(async () => {
    const mockPrisma = {
      resource: {
        findFirst: jest.fn(),
      },
      bookingRule: {
        findMany: jest.fn(),
        deleteMany: jest.fn(),
        createMany: jest.fn(),
      },
      $transaction: jest.fn((callback) => callback(mockPrisma)),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BookingRulesService,
        {
          provide: PrismaService,
          useValue: mockPrisma,
        },
      ],
    }).compile();

    service = module.get<BookingRulesService>(BookingRulesService);
    prismaService = module.get(PrismaService);
  });

  it('should throw BadRequestException if duplicate day_scope is provided', async () => {
    (prismaService.resource.findFirst as jest.Mock).mockResolvedValue({
      id: 'res-1',
      groupId: 'group-1',
      slotDurationMinutes: 30,
    });

    await expect(
      service.upsertRules('group-1', 'res-1', [
        { dayScope: DayScope.WEEKDAY, maxBookingsPerDay: 2 },
        { dayScope: DayScope.WEEKDAY, maxBookingsPerDay: 3 },
      ]),
    ).rejects.toThrow(BadRequestException);
  });

  it('should throw BadRequestException if availableFrom >= availableUntil', async () => {
    (prismaService.resource.findFirst as jest.Mock).mockResolvedValue({
      id: 'res-1',
      groupId: 'group-1',
      slotDurationMinutes: 30,
    });

    await expect(
      service.upsertRules('group-1', 'res-1', [
        {
          dayScope: DayScope.WEEKDAY,
          availableFrom: '18:00',
          availableUntil: '08:00',
        },
      ]),
    ).rejects.toThrow(BadRequestException);
  });

  it('should throw BadRequestException if minDurationMinutes < resource slotDurationMinutes', async () => {
    (prismaService.resource.findFirst as jest.Mock).mockResolvedValue({
      id: 'res-1',
      groupId: 'group-1',
      slotDurationMinutes: 60,
    });

    await expect(
      service.upsertRules('group-1', 'res-1', [
        {
          dayScope: DayScope.WEEKDAY,
          minDurationMinutes: 30,
        },
      ]),
    ).rejects.toThrow(BadRequestException);
  });

  it('should replace all rules when valid rules are provided', async () => {
    (prismaService.resource.findFirst as jest.Mock).mockResolvedValue({
      id: 'res-1',
      groupId: 'group-1',
      slotDurationMinutes: 30,
    });
    (prismaService.bookingRule.findMany as jest.Mock).mockResolvedValue([
      {
        id: 'rule-1',
        resourceId: 'res-1',
        dayScope: DayScope.WEEKDAY,
        maxBookingsPerDay: 2,
        availableFrom: '08:00',
        availableUntil: '22:00',
      },
    ]);

    const result = await service.upsertRules('group-1', 'res-1', [
      {
        dayScope: DayScope.WEEKDAY,
        maxBookingsPerDay: 2,
        availableFrom: '08:00',
        availableUntil: '22:00',
      },
    ]);

    expect(result).toHaveLength(1);
    expect(result[0]).toHaveProperty('dayScope', DayScope.WEEKDAY);
  });
});
