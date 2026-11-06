import { Test, TestingModule } from '@nestjs/testing';
import { ResourcesService } from './resources.service';
import { PrismaService } from '../prisma/prisma.service';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { GroupRole } from '@prisma/client';

describe('ResourcesService', () => {
  let service: ResourcesService;
  let prismaService: jest.Mocked<PrismaService>;

  beforeEach(async () => {
    const mockPrisma = {
      resource: {
        create: jest.fn(),
        findMany: jest.fn(),
        findFirst: jest.fn(),
        update: jest.fn(),
      },
      booking: {
        updateMany: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ResourcesService,
        {
          provide: PrismaService,
          useValue: mockPrisma,
        },
      ],
    }).compile();

    service = module.get<ResourcesService>(ResourcesService);
    prismaService = module.get(PrismaService);
  });

  it('should throw BadRequestException if slotDurationMinutes is not a multiple of 15', async () => {
    await expect(
      service.createResource('group-1', {
        name: 'Washing Machine',
        capacity: 1,
        slotDurationMinutes: 20,
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('should create a resource with valid parameters', async () => {
    const mockResource = {
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

    (prismaService.resource.create as jest.Mock).mockResolvedValue(
      mockResource,
    );

    const result = await service.createResource('group-1', {
      name: 'Washing Machine',
      description: 'Laundry',
      capacity: 1,
      slotDurationMinutes: 60,
    });

    expect(result).toHaveProperty('id', 'res-1');
    expect(result).toHaveProperty('slotDurationMinutes', 60);
  });

  it('should create a resource configured in hours', async () => {
    const mockResource = {
      id: 'res-hours',
      groupId: 'group-1',
      name: 'Conference Room',
      capacity: 10,
      slotDurationMinutes: 120,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    (prismaService.resource.create as jest.Mock).mockResolvedValue(
      mockResource,
    );

    const result = await service.createResource('group-1', {
      name: 'Conference Room',
      capacity: 10,
      slotDuration: 2,
      slotDurationUnit: 'hours',
    });

    expect(prismaService.resource.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          slotDurationMinutes: 120,
        }),
      }),
    );
    expect(result).toHaveProperty('slotDurationMinutes', 120);
  });

  it('should create a resource configured in days', async () => {
    const mockResource = {
      id: 'res-days',
      groupId: 'group-1',
      name: 'Guest Apartment',
      capacity: 1,
      slotDurationMinutes: 1440,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    (prismaService.resource.create as jest.Mock).mockResolvedValue(
      mockResource,
    );

    const result = await service.createResource('group-1', {
      name: 'Guest Apartment',
      capacity: 1,
      slotDuration: 1,
      slotDurationUnit: 'days',
    });

    expect(prismaService.resource.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          slotDurationMinutes: 1440,
        }),
      }),
    );
    expect(result).toHaveProperty('slotDurationMinutes', 1440);
  });

  it('should create a resource with icon', async () => {
    const mockResource = {
      id: 'res-wm',
      groupId: 'group-1',
      name: 'Laundry Machine 1',
      description: 'Ground floor',
      icon: 'washing_machine',
      capacity: 1,
      slotDurationMinutes: 30,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    (prismaService.resource.create as jest.Mock).mockResolvedValue(
      mockResource,
    );

    const result = await service.createResource('group-1', {
      name: 'Laundry Machine 1',
      description: 'Ground floor',
      icon: 'washing_machine',
      capacity: 1,
      slotDurationMinutes: 30,
    });

    expect(result).toHaveProperty('id', 'res-wm');
    expect(result).toHaveProperty('icon', 'washing_machine');
    expect(prismaService.resource.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          icon: 'washing_machine',
        }),
      }),
    );
  });

  it('should return active resources and compute rulesConfigured', async () => {
    const mockResources = [
      {
        id: 'res-1',
        groupId: 'group-1',
        name: 'Washing Machine',
        capacity: 1,
        slotDurationMinutes: 60,
        isActive: true,
        _count: { bookingRules: 2 },
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ];

    (prismaService.resource.findMany as jest.Mock).mockResolvedValue(
      mockResources,
    );

    const result = await service.getResources(
      'group-1',
      false,
      GroupRole.MEMBER,
    );
    expect(result[0]).toHaveProperty('rulesConfigured', true);
  });

  it('should soft delete resource and cancel future bookings', async () => {
    (prismaService.resource.findFirst as jest.Mock).mockResolvedValue({
      id: 'res-1',
      groupId: 'group-1',
    });
    (prismaService.resource.update as jest.Mock).mockResolvedValue({
      id: 'res-1',
      isActive: false,
    });

    await service.deleteResource('group-1', 'res-1');
    expect(prismaService.resource.update).toHaveBeenCalledWith({
      where: { id: 'res-1' },
      data: { isActive: false },
    });
    expect(prismaService.booking.updateMany).toHaveBeenCalled();
  });

  it('should include inactive resources for ADMIN when includeInactive is true', async () => {
    (prismaService.resource.findMany as jest.Mock).mockResolvedValue([]);

    await service.getResources('group-1', true, GroupRole.ADMIN);
    const callArgs = (prismaService.resource.findMany as jest.Mock).mock
      .calls[0][0];
    expect(callArgs.where).not.toHaveProperty('isActive');
  });

  it('should include inactive resources for MODERATOR when includeInactive is true', async () => {
    (prismaService.resource.findMany as jest.Mock).mockResolvedValue([]);

    await service.getResources('group-1', true, GroupRole.MODERATOR);
    const callArgs = (prismaService.resource.findMany as jest.Mock).mock
      .calls[0][0];
    expect(callArgs.where).not.toHaveProperty('isActive');
  });

  it('should filter to active resources for non-admin even if includeInactive requested', async () => {
    (prismaService.resource.findMany as jest.Mock).mockResolvedValue([]);

    await service.getResources('group-1', true, GroupRole.MEMBER);
    const callArgs = (prismaService.resource.findMany as jest.Mock).mock
      .calls[0][0];
    expect(callArgs.where).toHaveProperty('isActive', true);
  });

  it('should throw NotFoundException if resource not found in getResourceDetails', async () => {
    (prismaService.resource.findFirst as jest.Mock).mockResolvedValue(null);

    await expect(
      service.getResourceDetails('group-1', 'res-1'),
    ).rejects.toThrow(NotFoundException);
  });

  it('should return resource details with booking rules', async () => {
    (prismaService.resource.findFirst as jest.Mock).mockResolvedValue({
      id: 'res-1',
      groupId: 'group-1',
      name: 'Washing Machine',
      description: 'Laundry',
      capacity: 1,
      slotDurationMinutes: 60,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
      bookingRules: [
        {
          id: 'rule-1',
          dayScope: 'WEEKDAY',
          maxBookingsPerDay: 2,
          maxHoursPerDay: 3,
          cooldownMinutes: 30,
          minDurationMinutes: 30,
          maxDurationMinutes: 120,
          maxAdvanceBookingDays: 7,
          availableFrom: '08:00',
          availableUntil: '22:00',
        },
      ],
    });

    const result = await service.getResourceDetails('group-1', 'res-1');
    expect(result.bookingRules).toHaveLength(1);
    expect(result.bookingRules[0]).toHaveProperty('dayScope', 'WEEKDAY');
  });

  it('should throw BadRequestException if updateResource slot duration is invalid', async () => {
    await expect(
      service.updateResource('group-1', 'res-1', {
        slotDurationMinutes: 20,
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('should throw NotFoundException if resource not found in updateResource', async () => {
    (prismaService.resource.findFirst as jest.Mock).mockResolvedValue(null);

    await expect(
      service.updateResource('group-1', 'res-1', { name: 'New Name' }),
    ).rejects.toThrow(NotFoundException);
  });

  it('should update resource fields', async () => {
    (prismaService.resource.findFirst as jest.Mock).mockResolvedValue({
      id: 'res-1',
      groupId: 'group-1',
    });
    (prismaService.resource.update as jest.Mock).mockResolvedValue({
      id: 'res-1',
      groupId: 'group-1',
      name: 'Updated',
      description: 'desc',
      capacity: 3,
      slotDurationMinutes: 30,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const result = await service.updateResource('group-1', 'res-1', {
      name: 'Updated',
      capacity: 3,
      isActive: false,
    });
    expect(result).toHaveProperty('name', 'Updated');
    expect(result).toHaveProperty('capacity', 3);
    expect(prismaService.resource.update).toHaveBeenCalledWith({
      where: { id: 'res-1' },
      data: {
        name: 'Updated',
        capacity: 3,
        isActive: false,
      },
    });
  });

  it('should update resource icon and clear icon when empty', async () => {
    (prismaService.resource.findFirst as jest.Mock).mockResolvedValue({
      id: 'res-1',
      groupId: 'group-1',
    });
    (prismaService.resource.update as jest.Mock).mockResolvedValue({
      id: 'res-1',
      groupId: 'group-1',
      name: 'Computer Lab',
      icon: 'computer',
      capacity: 1,
      slotDurationMinutes: 30,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    await service.updateResource('group-1', 'res-1', {
      icon: 'computer',
    });
    expect(prismaService.resource.update).toHaveBeenCalledWith({
      where: { id: 'res-1' },
      data: {
        icon: 'computer',
      },
    });

    // Clear icon test
    await service.updateResource('group-1', 'res-1', {
      icon: '',
    });
    expect(prismaService.resource.update).toHaveBeenCalledWith({
      where: { id: 'res-1' },
      data: {
        icon: null,
      },
    });

    // Update color test
    (prismaService.resource.update as jest.Mock).mockResolvedValue({
      id: 'res-1',
      groupId: 'group-1',
      name: 'Computer Lab',
      icon: 'computer',
      color: '#3B82F6',
      capacity: 1,
      slotDurationMinutes: 30,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    const colorUpdated = await service.updateResource('group-1', 'res-1', {
      color: '#3B82F6',
    });
    expect(colorUpdated).toHaveProperty('color', '#3B82F6');
    expect(prismaService.resource.update).toHaveBeenCalledWith({
      where: { id: 'res-1' },
      data: {
        color: '#3B82F6',
      },
    });
  });

  it('should throw NotFoundException if resource not found in deleteResource', async () => {
    (prismaService.resource.findFirst as jest.Mock).mockResolvedValue(null);

    await expect(service.deleteResource('group-1', 'res-1')).rejects.toThrow(
      NotFoundException,
    );
  });
});
