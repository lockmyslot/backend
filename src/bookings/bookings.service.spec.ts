import { Test, TestingModule } from '@nestjs/testing';
import { BookingsService } from './bookings.service';
import { RulesService } from './rules.service';
import { PrismaService } from '../prisma/prisma.service';
import {
  NotFoundException,
  BadRequestException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { BookingStatus, GroupRole, DayScope } from '@prisma/client';

describe('BookingsService', () => {
  let service: BookingsService;
  let prismaService: jest.Mocked<PrismaService>;
  let rulesService: jest.Mocked<RulesService>;

  const mockResource = {
    id: 'res-1',
    groupId: 'group-1',
    name: 'Washing Machine',
    description: 'Laundry',
    capacity: 2,
    slotDurationMinutes: 60,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockBooking = {
    id: 'booking-1',
    resourceId: 'res-1',
    userId: 'user-1',
    groupId: 'group-1',
    startTime: new Date('2026-08-11T09:00:00.000Z'),
    endTime: new Date('2026-08-11T10:00:00.000Z'),
    status: BookingStatus.CONFIRMED,
    createdAt: new Date(),
  };

  beforeEach(async () => {
    const mockPrisma = {
      resource: {
        findFirst: jest.fn(),
      },
      bookingRule: {
        findFirst: jest.fn(),
      },
      booking: {
        count: jest.fn(),
        findMany: jest.fn(),
        findFirst: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      maintenanceTask: {
        findMany: jest.fn().mockResolvedValue([]),
      },
      $transaction: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BookingsService,
        {
          provide: PrismaService,
          useValue: mockPrisma,
        },
        {
          provide: RulesService,
          useValue: {
            validate: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<BookingsService>(BookingsService);
    prismaService = module.get(PrismaService);
    rulesService = module.get(RulesService);
  });

  describe('createBooking', () => {
    const dto = {
      startTime: '2026-08-11T09:00:00.000Z',
      endTime: '2026-08-11T10:00:00.000Z',
    };

    it('should throw NotFoundException if resource not found in group', async () => {
      (prismaService.resource.findFirst as jest.Mock).mockResolvedValue(null);

      await expect(
        service.createBooking('group-1', 'res-1', 'user-1', dto),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw ConflictException with slot_full when capacity error', async () => {
      (prismaService.resource.findFirst as jest.Mock).mockResolvedValue(
        mockResource,
      );
      (rulesService.validate as jest.Mock).mockResolvedValue({
        allowed: false,
        violations: ['capacity'],
        isCapacityError: true,
      });

      await expect(
        service.createBooking('group-1', 'res-1', 'user-1', dto),
      ).rejects.toThrow(ConflictException);
    });

    it('should throw BadRequestException with booking_rule_violation on rule violation', async () => {
      (prismaService.resource.findFirst as jest.Mock).mockResolvedValue(
        mockResource,
      );
      (rulesService.validate as jest.Mock).mockResolvedValue({
        allowed: false,
        violations: ['rule'],
        isCapacityError: false,
      });

      await expect(
        service.createBooking('group-1', 'res-1', 'user-1', dto),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw ConflictException if overlap count reaches capacity inside transaction', async () => {
      (prismaService.resource.findFirst as jest.Mock).mockResolvedValue(
        mockResource,
      );
      (rulesService.validate as jest.Mock).mockResolvedValue({
        allowed: true,
        violations: [],
        isCapacityError: false,
      });

      const tx = {
        maintenanceTask: {
          findMany: jest.fn().mockResolvedValue([]),
        },
        booking: {
          count: jest.fn().mockResolvedValue(2),
          create: jest.fn(),
        },
      };
      (prismaService.$transaction as jest.Mock).mockImplementation((cb) =>
        cb(tx),
      );

      await expect(
        service.createBooking('group-1', 'res-1', 'user-1', dto),
      ).rejects.toThrow(ConflictException);
    });

    it('should create a booking successfully and return the mapped response', async () => {
      (prismaService.resource.findFirst as jest.Mock).mockResolvedValue(
        mockResource,
      );
      (rulesService.validate as jest.Mock).mockResolvedValue({
        allowed: true,
        violations: [],
        isCapacityError: false,
      });

      const tx = {
        maintenanceTask: {
          findMany: jest.fn().mockResolvedValue([]),
        },
        booking: {
          count: jest.fn().mockResolvedValue(0),
          create: jest.fn().mockResolvedValue(mockBooking),
        },
      };
      (prismaService.$transaction as jest.Mock).mockImplementation((cb) =>
        cb(tx),
      );

      const result = await service.createBooking(
        'group-1',
        'res-1',
        'user-1',
        dto,
      );
      expect(result).toHaveProperty('id', 'booking-1');
      expect(result).toHaveProperty('resourceName', 'Washing Machine');
      expect(result).toHaveProperty('status', BookingStatus.CONFIRMED);
    });
  });

  describe('getResourceBookings', () => {
    it('should throw NotFoundException if resource not found', async () => {
      (prismaService.resource.findFirst as jest.Mock).mockResolvedValue(null);

      await expect(
        service.getResourceBookings('group-1', 'res-1', {}),
      ).rejects.toThrow(NotFoundException);
    });

    it('should query with specific date when query.date is provided', async () => {
      (prismaService.resource.findFirst as jest.Mock).mockResolvedValue(
        mockResource,
      );
      (prismaService.booking.findMany as jest.Mock).mockResolvedValue([
        { ...mockBooking, user: { displayName: 'Alice' } },
      ]);

      const result = await service.getResourceBookings('group-1', 'res-1', {
        date: '2026-08-11',
      });
      expect(result[0]).toHaveProperty('userDisplayName', 'Alice');
      expect(prismaService.booking.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ resourceId: 'res-1' }),
        }),
      );
    });

    it('should default to 7-day window when neither date nor from/to provided', async () => {
      (prismaService.resource.findFirst as jest.Mock).mockResolvedValue(
        mockResource,
      );
      (prismaService.booking.findMany as jest.Mock).mockResolvedValue([]);

      await service.getResourceBookings('group-1', 'res-1', {});
      const callArgs = (prismaService.booking.findMany as jest.Mock).mock
        .calls[0][0];
      expect(callArgs.where.startTime).toHaveProperty('gte');
      expect(callArgs.where.endTime).toHaveProperty('lte');
    });

    it('should honor from/to range when provided', async () => {
      (prismaService.resource.findFirst as jest.Mock).mockResolvedValue(
        mockResource,
      );
      (prismaService.booking.findMany as jest.Mock).mockResolvedValue([]);

      await service.getResourceBookings('group-1', 'res-1', {
        from: '2026-08-11',
        to: '2026-08-18',
      });
      const callArgs = (prismaService.booking.findMany as jest.Mock).mock
        .calls[0][0];
      expect(callArgs.where.startTime).toHaveProperty('gte');
      expect(callArgs.where.endTime).toHaveProperty('lte');
    });
  });

  describe('getAvailability', () => {
    it('should throw NotFoundException if resource not found', async () => {
      (prismaService.resource.findFirst as jest.Mock).mockResolvedValue(null);

      await expect(
        service.getAvailability('group-1', 'res-1', 'user-1', '2026-08-11'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should generate slots and mark full when capacity reached', async () => {
      (prismaService.resource.findFirst as jest.Mock).mockResolvedValue({
        ...mockResource,
        slotDurationMinutes: 60,
        capacity: 1,
      });
      (prismaService.bookingRule.findFirst as jest.Mock).mockResolvedValue({
        id: 'rule-1',
        resourceId: 'res-1',
        dayScope: DayScope.MONDAY,
        availableFrom: '09:00',
        availableUntil: '11:00',
      });
      (prismaService.booking.findMany as jest.Mock).mockResolvedValue([
        {
          startTime: new Date('2026-08-11T09:00:00.000Z'),
          endTime: new Date('2026-08-11T10:00:00.000Z'),
          userId: 'user-2',
        },
      ]);

      const result = await service.getAvailability(
        'group-1',
        'res-1',
        'user-1',
        '2026-08-11',
      );
      expect(result.slots.length).toBe(2);
      expect(result.slots[0].status).toBe('full');
      expect(result.userStats.bookingsToday).toBe(0);
    });

    it('should mark slot as cooldown when violating cooldown rule', async () => {
      (prismaService.resource.findFirst as jest.Mock).mockResolvedValue({
        ...mockResource,
        slotDurationMinutes: 60,
        capacity: 2,
      });
      (prismaService.bookingRule.findFirst as jest.Mock).mockResolvedValue({
        id: 'rule-1',
        resourceId: 'res-1',
        dayScope: DayScope.MONDAY,
        availableFrom: '09:00',
        availableUntil: '12:00',
        cooldownMinutes: 60,
      });
      // User's own bookings that trigger cooldown
      (prismaService.booking.findMany as jest.Mock).mockResolvedValue([
        {
          startTime: new Date('2026-08-11T08:00:00.000Z'),
          endTime: new Date('2026-08-11T09:00:00.000Z'),
          userId: 'user-1',
        },
        {
          startTime: new Date('2026-08-11T09:00:00.000Z'),
          endTime: new Date('2026-08-11T10:00:00.000Z'),
          userId: 'user-1',
        },
      ]);

      const result = await service.getAvailability(
        'group-1',
        'res-1',
        'user-1',
        '2026-08-11',
      );
      expect(result.slots.length).toBeGreaterThan(0);
      expect(result.userStats.bookingsToday).toBe(2);
      expect(result.userStats.lastBookingEnd).toBeDefined();
    });

    it('should fall back to day-group rule when day-specific rule missing', async () => {
      (prismaService.resource.findFirst as jest.Mock).mockResolvedValue(
        mockResource,
      );
      (prismaService.bookingRule.findFirst as jest.Mock)
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({
          id: 'rule-1',
          resourceId: 'res-1',
          dayScope: DayScope.WEEKDAY,
          availableFrom: '08:00',
          availableUntil: '22:00',
        });
      (prismaService.booking.findMany as jest.Mock).mockResolvedValue([]);

      const result = await service.getAvailability(
        'group-1',
        'res-1',
        'user-1',
        '2026-08-11',
      );
      expect(result.availableFrom).toBe('08:00');
      expect(result.availableUntil).toBe('22:00');
    });

    it('should use 00:00-24:00 defaults when no rule configured', async () => {
      (prismaService.resource.findFirst as jest.Mock).mockResolvedValue({
        ...mockResource,
        slotDurationMinutes: 60,
      });
      (prismaService.bookingRule.findFirst as jest.Mock).mockResolvedValue(
        null,
      );
      (prismaService.booking.findMany as jest.Mock).mockResolvedValue([]);

      const result = await service.getAvailability(
        'group-1',
        'res-1',
        'user-1',
        '2026-08-11',
      );
      expect(result.availableFrom).toBe('00:00');
      expect(result.availableUntil).toBe('24:00');
    });
  });

  describe('cancelBooking', () => {
    it('should throw NotFoundException if booking not found', async () => {
      (prismaService.booking.findFirst as jest.Mock).mockResolvedValue(null);

      await expect(
        service.cancelBooking(
          'group-1',
          'booking-1',
          'user-1',
          GroupRole.MEMBER,
        ),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw ForbiddenException if not owner and not admin', async () => {
      (prismaService.booking.findFirst as jest.Mock).mockResolvedValue({
        ...mockBooking,
        userId: 'user-2',
      });

      await expect(
        service.cancelBooking(
          'group-1',
          'booking-1',
          'user-1',
          GroupRole.MEMBER,
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should allow admin to cancel someone elses booking', async () => {
      (prismaService.booking.findFirst as jest.Mock).mockResolvedValue({
        ...mockBooking,
        userId: 'user-2',
        startTime: new Date('2099-08-11T09:00:00.000Z'),
      });
      (prismaService.booking.update as jest.Mock).mockResolvedValue({});

      await service.cancelBooking(
        'group-1',
        'booking-1',
        'user-1',
        GroupRole.ADMIN,
      );
      expect(prismaService.booking.update).toHaveBeenCalled();
    });

    it('should throw BadRequestException if booking already cancelled', async () => {
      (prismaService.booking.findFirst as jest.Mock).mockResolvedValue({
        ...mockBooking,
        status: BookingStatus.CANCELLED,
      });

      await expect(
        service.cancelBooking(
          'group-1',
          'booking-1',
          'user-1',
          GroupRole.MEMBER,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException if booking is in the past', async () => {
      (prismaService.booking.findFirst as jest.Mock).mockResolvedValue({
        ...mockBooking,
        startTime: new Date('2020-01-01T09:00:00.000Z'),
      });

      await expect(
        service.cancelBooking(
          'group-1',
          'booking-1',
          'user-1',
          GroupRole.MEMBER,
        ),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('getMyBookings', () => {
    it('should default to 30-day window and CONFIRMED status', async () => {
      (prismaService.booking.findMany as jest.Mock).mockResolvedValue([
        { ...mockBooking, resource: { name: 'Washing Machine' } },
      ]);

      const result = await service.getMyBookings('group-1', 'user-1', {});
      expect(result[0]).toHaveProperty('resourceName', 'Washing Machine');
      const callArgs = (prismaService.booking.findMany as jest.Mock).mock
        .calls[0][0];
      expect(callArgs.where.status).toBe(BookingStatus.CONFIRMED);
    });

    it('should use provided from/to and status filter', async () => {
      (prismaService.booking.findMany as jest.Mock).mockResolvedValue([]);

      await service.getMyBookings('group-1', 'user-1', {
        from: '2026-08-01',
        to: '2026-08-31',
        status: BookingStatus.CANCELLED,
      });
      const callArgs = (prismaService.booking.findMany as jest.Mock).mock
        .calls[0][0];
      expect(callArgs.where.status).toBe(BookingStatus.CANCELLED);
      expect(callArgs.where.startTime).toHaveProperty('gte');
      expect(callArgs.where.startTime).toHaveProperty('lte');
    });
  });
});
