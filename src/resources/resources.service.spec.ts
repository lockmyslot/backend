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

    (prismaService.resource.create as jest.Mock).mockResolvedValue(mockResource);

    const result = await service.createResource('group-1', {
      name: 'Washing Machine',
      description: 'Laundry',
      capacity: 1,
      slotDurationMinutes: 60,
    });

    expect(result).toHaveProperty('id', 'res-1');
    expect(result).toHaveProperty('slotDurationMinutes', 60);
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

    (prismaService.resource.findMany as jest.Mock).mockResolvedValue(mockResources);

    const result = await service.getResources('group-1', false, GroupRole.MEMBER);
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
});
